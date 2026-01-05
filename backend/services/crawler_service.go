package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/datvt88/CPLS/backend/config"
	"github.com/datvt88/CPLS/backend/models"
	"github.com/go-resty/resty/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	// VNDirect API URLs
	stockListURL  = "https://api-finfo.vndirect.com.vn/v4/stocks"
	stockPriceURL = "https://api-finfo.vndirect.com.vn/v4/stock_prices"

	// Worker pool configuration
	numWorkers = 8 // Number of concurrent workers

	// Rate limiting
	requestDelay = 150 * time.Millisecond // Delay between requests
)

// VNDirectStockResponse represents the response from VNDirect stock list API
type VNDirectStockResponse struct {
	Data []struct {
		Code        string `json:"code"`
		CompanyName string `json:"companyName"`
		Exchange    string `json:"exchange"`
		Type        string `json:"type"`
		Status      string `json:"status"`
	} `json:"data"`
}

// VNDirectPriceResponse represents the response from VNDirect price API
type VNDirectPriceResponse struct {
	Data []struct {
		Code   string  `json:"code"`
		Date   string  `json:"date"`
		Open   float64 `json:"open"`
		High   float64 `json:"high"`
		Low    float64 `json:"low"`
		Close  float64 `json:"close"`
		Volume int64   `json:"volume"`
	} `json:"data"`
}

// CrawlerService handles the crawling logic
type CrawlerService struct {
	client          *resty.Client
	stockCollection *mongo.Collection
	priceCollection *mongo.Collection
}

// NewCrawlerService creates a new crawler service instance
func NewCrawlerService() *CrawlerService {
	client := resty.New()
	client.SetTimeout(30 * time.Second)
	client.SetRetryCount(3)
	client.SetRetryWaitTime(2 * time.Second)

	return &CrawlerService{
		client:          client,
		stockCollection: config.GetCollection("stocks"),
		priceCollection: config.GetCollection("stock_prices"),
	}
}

// StartCrawling starts the crawling process in the background
func (cs *CrawlerService) StartCrawling() error {
	// Run in goroutine to avoid blocking
	go func() {
		log.Println("🚀 Starting market data crawling process...")

		// Step 1: Fetch and save stock list
		stocks, err := cs.fetchStockList()
		if err != nil {
			log.Printf("❌ Error fetching stock list: %v", err)
			return
		}

		log.Printf("✓ Fetched %d stocks from VNDirect", len(stocks))

		// Step 2: Save stocks to database
		err = cs.saveStocks(stocks)
		if err != nil {
			log.Printf("❌ Error saving stocks: %v", err)
			return
		}

		log.Printf("✓ Saved stocks to database")

		// Step 3: Crawl prices for all stocks using worker pool
		cs.crawlPricesWithWorkerPool(stocks)

		log.Println("✅ Crawling process completed!")
	}()

	return nil
}

// fetchStockList fetches the list of stocks from VNDirect
func (cs *CrawlerService) fetchStockList() ([]models.Stock, error) {
	url := fmt.Sprintf("%s?q=type:stock~status:listed~floor:HOSE,HNX,UPCOM&size=9999", stockListURL)

	resp, err := cs.client.R().Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch stock list: %w", err)
	}

	var apiResp VNDirectStockResponse
	err = json.Unmarshal(resp.Body(), &apiResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse stock list response: %w", err)
	}

	stocks := make([]models.Stock, 0, len(apiResp.Data))
	now := primitive.NewDateTimeFromTime(time.Now())

	for _, item := range apiResp.Data {
		stock := models.Stock{
			Code:        item.Code,
			CompanyName: item.CompanyName,
			Exchange:    item.Exchange,
			Type:        item.Type,
			Status:      item.Status,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		stocks = append(stocks, stock)
	}

	return stocks, nil
}

// saveStocks saves or updates stocks in the database
func (cs *CrawlerService) saveStocks(stocks []models.Stock) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var errorCount int
	for _, stock := range stocks {
		filter := bson.M{"code": stock.Code}
		update := bson.M{
			"$set": bson.M{
				"companyName": stock.CompanyName,
				"exchange":    stock.Exchange,
				"type":        stock.Type,
				"status":      stock.Status,
				"updatedAt":   stock.UpdatedAt,
			},
			"$setOnInsert": bson.M{
				"createdAt": stock.CreatedAt,
			},
		}

		opts := options.Update().SetUpsert(true)
		_, err := cs.stockCollection.UpdateOne(ctx, filter, update, opts)
		if err != nil {
			log.Printf("⚠️  Failed to upsert stock %s: %v", stock.Code, err)
			errorCount++
		}
	}

	if errorCount > 0 {
		log.Printf("⚠️  Failed to save %d out of %d stocks", errorCount, len(stocks))
	}

	return nil
}

// crawlPricesWithWorkerPool crawls prices using a worker pool pattern
func (cs *CrawlerService) crawlPricesWithWorkerPool(stocks []models.Stock) {
	// Create a channel for jobs
	jobs := make(chan models.Stock, len(stocks))
	var wg sync.WaitGroup

	// Start workers
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go cs.priceWorker(i+1, jobs, &wg)
	}

	// Send jobs to workers
	for _, stock := range stocks {
		jobs <- stock
	}
	close(jobs)

	// Wait for all workers to finish
	wg.Wait()
}

// priceWorker is a worker that processes price fetching jobs
func (cs *CrawlerService) priceWorker(id int, jobs <-chan models.Stock, wg *sync.WaitGroup) {
	defer wg.Done()

	for stock := range jobs {
		log.Printf("Worker #%d: Processing %s", id, stock.Code)

		// Fetch price data from API
		prices, err := cs.fetchStockPrices(stock.Code)
		if err != nil {
			log.Printf("❌ Worker #%d: Failed to fetch prices for %s: %v", id, stock.Code, err)
			continue
		}

		if len(prices) == 0 {
			log.Printf("⚠️  Worker #%d: No price data for %s", id, stock.Code)
			continue
		}

		// Save prices to database using bucket pattern
		err = cs.savePricesToBuckets(stock.Code, prices)
		if err != nil {
			log.Printf("❌ Worker #%d: Failed to save prices for %s: %v", id, stock.Code, err)
			continue
		}

		log.Printf("✓ Worker #%d: Saved %d price records for %s", id, len(prices), stock.Code)

		// Rate limiting: sleep between requests
		time.Sleep(requestDelay)
	}
}

// fetchStockPrices fetches price history for a stock code
func (cs *CrawlerService) fetchStockPrices(code string) ([]models.CandleData, error) {
	url := fmt.Sprintf("%s?sort=date:desc&q=code:%s&size=270", stockPriceURL, code)

	resp, err := cs.client.R().Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch prices: %w", err)
	}

	var apiResp VNDirectPriceResponse
	err = json.Unmarshal(resp.Body(), &apiResp)
	if err != nil {
		return nil, fmt.Errorf("failed to parse price response: %w", err)
	}

	candles := make([]models.CandleData, 0, len(apiResp.Data))
	for _, item := range apiResp.Data {
		candle := models.CandleData{
			D: item.Date,
			O: item.Open,
			H: item.High,
			L: item.Low,
			C: item.Close,
			V: item.Volume,
		}
		candles = append(candles, candle)
	}

	return candles, nil
}

// savePricesToBuckets saves price data to MongoDB using bucket pattern
func (cs *CrawlerService) savePricesToBuckets(code string, candles []models.CandleData) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Group candles by year
	bucketsByYear := make(map[int][]models.CandleData)
	for _, candle := range candles {
		year, err := models.GetYearFromDate(candle.D)
		if err != nil {
			log.Printf("⚠️  Invalid date format for %s: %s", code, candle.D)
			continue
		}
		bucketsByYear[year] = append(bucketsByYear[year], candle)
	}

	// Save each year's data to its bucket
	for year, yearCandles := range bucketsByYear {
		bucketID := models.GenerateBucketID(code, year)

		// Check if bucket exists
		filter := bson.M{"_id": bucketID}
		var existingBucket models.PriceBucket
		err := cs.priceCollection.FindOne(ctx, filter).Decode(&existingBucket)

		if err == mongo.ErrNoDocuments {
			// Create new bucket
			newBucket := models.PriceBucket{
				ID:      bucketID,
				Code:    code,
				Year:    year,
				History: yearCandles,
			}

			_, err := cs.priceCollection.InsertOne(ctx, newBucket)
			if err != nil {
				return fmt.Errorf("failed to insert new bucket: %w", err)
			}
		} else if err == nil {
			// Bucket exists - merge data without duplicates
			existingDates := make(map[string]bool)
			for _, candle := range existingBucket.History {
				existingDates[candle.D] = true
			}

			// Add only new candles
			newCandles := make([]models.CandleData, 0)
			for _, candle := range yearCandles {
				if !existingDates[candle.D] {
					newCandles = append(newCandles, candle)
				}
			}

			if len(newCandles) > 0 {
				update := bson.M{
					"$push": bson.M{
						"history": bson.M{
							"$each": newCandles,
						},
					},
				}

				_, err := cs.priceCollection.UpdateOne(ctx, filter, update)
				if err != nil {
					return fmt.Errorf("failed to update bucket: %w", err)
				}
			}
		} else {
			return fmt.Errorf("failed to check bucket existence: %w", err)
		}
	}

	return nil
}

// GetCrawlStatus returns the current status of the crawler (for monitoring)
func (cs *CrawlerService) GetCrawlStatus() (map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	stockCount, err := cs.stockCollection.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, err
	}

	bucketCount, err := cs.priceCollection.CountDocuments(ctx, bson.M{})
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total_stocks":        stockCount,
		"total_price_buckets": bucketCount,
		"timestamp":           time.Now().Format(time.RFC3339),
	}, nil
}
