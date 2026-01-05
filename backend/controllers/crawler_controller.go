package controllers

import (
	"net/http"

	"github.com/datvt88/CPLS/backend/services"
	"github.com/gin-gonic/gin"
)

// CrawlerController handles crawler-related HTTP requests
type CrawlerController struct {
	crawlerService *services.CrawlerService
}

// NewCrawlerController creates a new crawler controller
func NewCrawlerController() *CrawlerController {
	return &CrawlerController{
		crawlerService: services.NewCrawlerService(),
	}
}

// TriggerCrawl triggers the crawling process in the background
// @Summary Trigger market data crawling
// @Description Starts the crawling process for stock and price data from VNDirect
// @Tags crawler
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Crawling started successfully"
// @Router /api/crawler/start [post]
func (cc *CrawlerController) TriggerCrawl(c *gin.Context) {
	// Start crawling in background (non-blocking)
	err := cc.crawlerService.StartCrawling()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to start crawling",
			"error":   err.Error(),
		})
		return
	}

	// Return immediately while crawling continues in background
	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Crawling started in background. This process may take several minutes.",
		"note":    "Check the status endpoint to monitor progress",
	})
}

// GetStatus returns the current status of the crawler
// @Summary Get crawler status
// @Description Returns statistics about crawled data
// @Tags crawler
// @Accept json
// @Produce json
// @Success 200 {object} map[string]interface{} "Status information"
// @Router /api/crawler/status [get]
func (cc *CrawlerController) GetStatus(c *gin.Context) {
	status, err := cc.crawlerService.GetCrawlStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": "Failed to get crawler status",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   status,
	})
}
