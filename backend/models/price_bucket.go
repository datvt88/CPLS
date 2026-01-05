package models

import (
	"fmt"
	"time"
)

// CandleData represents a single candlestick with shortened field names to save storage
type CandleData struct {
	D string  `bson:"d" json:"d"` // Date (YYYY-MM-DD)
	O float64 `bson:"o" json:"o"` // Open price
	H float64 `bson:"h" json:"h"` // High price
	L float64 `bson:"l" json:"l"` // Low price
	C float64 `bson:"c" json:"c"` // Close price
	V int64   `bson:"v" json:"v"` // Volume
}

// PriceBucket represents a bucket of price data for a stock in a specific year
// This implements the Bucket Pattern to save storage in MongoDB
type PriceBucket struct {
	ID      string       `bson:"_id" json:"id"`          // Format: "{CODE}_{YEAR}" (e.g., "HPG_2024")
	Code    string       `bson:"code" json:"code"`       // Stock code
	Year    int          `bson:"year" json:"year"`       // Year
	History []CandleData `bson:"history" json:"history"` // Array of candles
}

// GenerateBucketID creates a bucket ID from code and year
func GenerateBucketID(code string, year int) string {
	return fmt.Sprintf("%s_%d", code, year)
}

// GetYearFromDate extracts year from date string (format: YYYY-MM-DD)
func GetYearFromDate(dateStr string) (int, error) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0, err
	}
	return t.Year(), nil
}
