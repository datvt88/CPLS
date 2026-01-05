package main

import (
	"log"
	"os"

	"github.com/datvt88/CPLS/backend/config"
	"github.com/datvt88/CPLS/backend/controllers"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file (if exists)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Connect to MongoDB
	if err := config.ConnectMongoDB(); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer config.DisconnectMongoDB()

	// Initialize Gin router
	router := gin.Default()

	// CORS middleware for Cloud Run
	router.Use(corsMiddleware())

	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "healthy",
			"service": "CPLS Market Data Crawler",
			"version": "1.0.0",
		})
	})

	// Initialize controllers
	crawlerController := controllers.NewCrawlerController()

	// API routes
	api := router.Group("/api")
	{
		crawler := api.Group("/crawler")
		{
			crawler.POST("/start", crawlerController.TriggerCrawl)
			crawler.GET("/status", crawlerController.GetStatus)
		}
	}

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// corsMiddleware adds CORS headers for Cloud Run
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
