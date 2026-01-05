package main

import (
	"log"
	"net/http"
	"os"

	"github.com/datvt88/CPLS/backend/config"
	"github.com/datvt88/CPLS/backend/controllers"
	"github.com/datvt88/CPLS/backend/middleware"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file (if exists)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Connect to PostgreSQL (Supabase)
	if err := config.ConnectPostgres(); err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer config.DisconnectPostgres()

	// Keep MongoDB connection for backward compatibility (if needed)
	// Comment out if you want to fully migrate to PostgreSQL
	// if err := config.ConnectMongoDB(); err != nil {
	// 	log.Printf("Warning: Failed to connect to MongoDB: %v", err)
	// }
	// defer config.DisconnectMongoDB()

	// Initialize Gin router
	router := gin.Default()

	// IMPORTANT: Trust proxies for Cloud Run
	// Cloud Run uses a Google-managed load balancer in front of the app
	// We need to trust ALL proxies (0.0.0.0/0 for IPv4, ::/0 for IPv6) because:
	// 1. Cloud Run is an isolated, managed environment - only Google's LB can access the container
	// 2. Cloud Run containers are NOT directly accessible from the internet
	// 3. All external traffic MUST go through Google's load balancer first
	// 4. We need Gin to recognize X-Forwarded-Proto header to detect HTTPS
	// 5. Without this, cookies with Secure=true won't be set (causing logout loops)
	// Note: SetTrustedProxies(nil) would DISABLE proxy trust, not enable it!
	// Note: This is safe because Cloud Run's network isolation prevents direct container access
	if err := router.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"}); err != nil {
		log.Printf("Warning: Failed to set trusted proxies: %v", err)
	}

	// Load HTML templates
	router.LoadHTMLGlob("templates/*")

	// Configure session middleware for Cloud Run
	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		// In production, fail fast if SESSION_SECRET is not set
		if os.Getenv("ENV") == "production" {
			log.Fatal("FATAL: SESSION_SECRET environment variable must be set in production")
		}
		// For development, warn and use default
		log.Println("WARNING: SESSION_SECRET not set. Using default (not recommended for production)")
		sessionSecret = "default-secret-change-in-production"
	}

	store := cookie.NewStore([]byte(sessionSecret))

	// Configure session options for Cloud Run (HTTPS environment)
	store.Options(sessions.Options{
		Path:   "/",
		Domain: "",        // Empty domain works for *.run.app domains
		MaxAge: 86400 * 7, // 7 days
		// Secure: true is CRITICAL for HTTPS (Cloud Run)
		// Even though the app runs HTTP internally, Cloud Run terminates HTTPS at the load balancer
		// The X-Forwarded-Proto header tells Gin the original protocol was HTTPS
		Secure:   true,
		HttpOnly: true, // Prevent JavaScript access to cookies (XSS protection)
		// SameSite: Lax is recommended for Cloud Run to prevent CSRF while allowing navigation
		SameSite: http.SameSiteLaxMode,
	})

	router.Use(sessions.Sessions("admin_session", store))

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
	adminController := controllers.NewAdminController()

	// Admin routes (with session-based authentication)
	admin := router.Group("/admin")
	{
		// Public routes (no auth required)
		admin.GET("/login", adminController.ShowLoginPage)
		admin.POST("/login", adminController.ProcessLogin)

		// Protected routes (auth required)
		admin.GET("/dashboard", middleware.AuthRequired(), adminController.ShowDashboard)
		admin.GET("/logout", middleware.AuthRequired(), adminController.Logout)

		// User management API endpoints
		admin.GET("/api/admin-users", middleware.AuthRequired(), adminController.GetAdminUsers)
		admin.GET("/api/profiles", middleware.AuthRequired(), adminController.GetProfiles)
	}

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
