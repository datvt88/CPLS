package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	// PostgresDB is the global PostgreSQL database instance using GORM
	PostgresDB *gorm.DB
)

// ConnectPostgres initializes connection to PostgreSQL (Supabase)
func ConnectPostgres() error {
	// Get database URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable not set")
	}

	// Configure GORM logger for debugging
	// This will show all SQL queries in the console
	gormLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags), // io writer
		logger.Config{
			SlowThreshold:             time.Second,   // Slow SQL threshold
			LogLevel:                  logger.Info,   // Log level (Info shows all SQL queries)
			IgnoreRecordNotFoundError: false,         // Log "record not found" errors
			Colorful:                  true,          // Colored output
		},
	)

	// Open database connection with GORM
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: gormLogger,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
		// PrepareStmt can improve performance by caching prepared statements
		// However, it's disabled here to avoid issues with connection pooling in Cloud Run
		// Enable if you're experiencing performance issues with repeated queries
		// PrepareStmt: true,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to PostgreSQL: %w", err)
	}

	// Get underlying SQL database
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL database: %w", err)
	}

	// Configure connection pool
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	// Set search_path to public schema (important for Supabase)
	// This ensures queries find tables in the public schema
	if err := db.Exec("SET search_path TO public").Error; err != nil {
		return fmt.Errorf("failed to set search_path: %w", err)
	}

	// If using Supabase Service Role Key, we can bypass RLS
	// by setting the session replication role to 'replica'
	// This allows the backend to read all data regardless of RLS policies
	serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if serviceRoleKey != "" {
		// Setting session replication role to 'replica' bypasses RLS
		// Only do this if you're using the service role key (super admin)
		if err := db.Exec("SET session_replication_role = 'replica'").Error; err != nil {
			log.Printf("Warning: Failed to set session_replication_role: %v", err)
			log.Printf("RLS bypass may not work. Ensure you're using SUPABASE_SERVICE_ROLE_KEY.")
		} else {
			log.Println("✓ RLS bypass enabled (session_replication_role = replica)")
		}
	} else {
		log.Println("⚠ SUPABASE_SERVICE_ROLE_KEY not set - RLS policies will apply")
	}

	PostgresDB = db

	log.Println("✓ Connected to PostgreSQL (Supabase)")
	log.Println("✓ GORM Debug mode enabled - SQL queries will be logged")
	return nil
}

// DisconnectPostgres closes the PostgreSQL connection
func DisconnectPostgres() error {
	if PostgresDB == nil {
		return nil
	}

	sqlDB, err := PostgresDB.DB()
	if err != nil {
		return fmt.Errorf("failed to get SQL database: %w", err)
	}

	if err := sqlDB.Close(); err != nil {
		return fmt.Errorf("failed to close PostgreSQL connection: %w", err)
	}

	log.Println("✓ Disconnected from PostgreSQL")
	return nil
}

// GetDB returns the GORM database instance with debug mode enabled
// Use this to ensure all queries are logged
func GetDB() *gorm.DB {
	return PostgresDB.Debug()
}
