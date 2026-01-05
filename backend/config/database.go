package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	// MongoClient is the global MongoDB client
	MongoClient *mongo.Client
	// Database is the database instance
	Database *mongo.Database
)

// ConnectMongoDB initializes connection to MongoDB
func ConnectMongoDB() error {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		return fmt.Errorf("MONGODB_URI environment variable not set")
	}

	dbName := os.Getenv("MONGODB_DATABASE")
	if dbName == "" {
		dbName = "cpls_trading" // Default database name
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Set client options
	clientOptions := options.Client().ApplyURI(mongoURI)

	// Connect to MongoDB
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping the database to verify connection
	err = client.Ping(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	MongoClient = client
	Database = client.Database(dbName)

	log.Printf("✓ Connected to MongoDB database: %s", dbName)
	return nil
}

// DisconnectMongoDB closes the MongoDB connection
func DisconnectMongoDB() error {
	if MongoClient == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	err := MongoClient.Disconnect(ctx)
	if err != nil {
		return fmt.Errorf("failed to disconnect from MongoDB: %w", err)
	}

	log.Println("✓ Disconnected from MongoDB")
	return nil
}

// GetCollection returns a collection from the database
func GetCollection(collectionName string) *mongo.Collection {
	return Database.Collection(collectionName)
}
