package services

import (
	"fmt"
	"log"

	"github.com/datvt88/CPLS/backend/config"
	"github.com/datvt88/CPLS/backend/models"
)

// UserService handles user-related business logic
type UserService struct{}

// NewUserService creates a new UserService instance
func NewUserService() *UserService {
	return &UserService{}
}

// GetAdminUsers retrieves all admin users from the admin_users table
// This function includes detailed logging for debugging purposes
func (s *UserService) GetAdminUsers() ([]models.AdminUser, error) {
	log.Println("=== GetAdminUsers: Starting query ===")

	var adminUsers []models.AdminUser

	// Get database instance with debug mode enabled
	db := config.GetDB()

	// Execute query with detailed logging
	result := db.Find(&adminUsers)

	// Check for errors
	if result.Error != nil {
		log.Printf("❌ GetAdminUsers: Database error: %v", result.Error)
		return nil, fmt.Errorf("failed to fetch admin users: %w", result.Error)
	}

	// Log results
	log.Printf("✓ GetAdminUsers: Found %d admin users", result.RowsAffected)
	for i, user := range adminUsers {
		username := "N/A"
		if user.Username != nil {
			username = *user.Username
		}
		fullName := "N/A"
		if user.FullName != nil {
			fullName = *user.FullName
		}
		log.Printf("  [%d] ID: %s, Email: %s, Username: %s, FullName: %s, Role: %s, Active: %v",
			i+1, user.ID, user.Email, username, fullName, user.Role, user.Active)
	}

	if len(adminUsers) == 0 {
		log.Println("⚠ GetAdminUsers: No admin users found in database")
		log.Println("  Possible reasons:")
		log.Println("  1. The admin_users table is empty")
		log.Println("  2. RLS (Row Level Security) is blocking access")
		log.Println("  3. Schema or table name is incorrect")
		log.Println("  4. Database connection is using wrong database/schema")
		log.Println("  Check the SQL query above to see what was executed.")
	}

	return adminUsers, nil
}

// GetProfiles retrieves all user profiles from the profiles table
// This function includes detailed logging for debugging purposes
func (s *UserService) GetProfiles() ([]models.Profile, error) {
	log.Println("=== GetProfiles: Starting query ===")

	var profiles []models.Profile

	// Get database instance with debug mode enabled
	db := config.GetDB()

	// Execute query with detailed logging
	result := db.Find(&profiles)

	// Check for errors
	if result.Error != nil {
		log.Printf("❌ GetProfiles: Database error: %v", result.Error)
		return nil, fmt.Errorf("failed to fetch profiles: %w", result.Error)
	}

	// Log results
	log.Printf("✓ GetProfiles: Found %d profiles", result.RowsAffected)
	for i, profile := range profiles {
		fullName := ""
		if profile.FullName != nil {
			fullName = *profile.FullName
		}
		nickname := ""
		if profile.Nickname != nil {
			nickname = *profile.Nickname
		}
		log.Printf("  [%d] ID: %s, Email: %s, Phone: %s, Name: %s, Nickname: %s, Membership: %s",
			i+1, profile.ID, profile.Email, profile.PhoneNumber, fullName, nickname, profile.Membership)
	}

	if len(profiles) == 0 {
		log.Println("⚠ GetProfiles: No profiles found in database")
		log.Println("  Possible reasons:")
		log.Println("  1. The profiles table is empty")
		log.Println("  2. RLS (Row Level Security) is blocking access")
		log.Println("  3. Schema or table name is incorrect")
		log.Println("  4. Database connection is using wrong database/schema")
		log.Println("  Check the SQL query above to see what was executed.")
	}

	return profiles, nil
}

// GetAdminUserByID retrieves a single admin user by ID
func (s *UserService) GetAdminUserByID(id string) (*models.AdminUser, error) {
	log.Printf("=== GetAdminUserByID: Looking for ID: %s ===", id)

	var adminUser models.AdminUser
	db := config.GetDB()

	result := db.First(&adminUser, "id = ?", id)
	if result.Error != nil {
		log.Printf("❌ GetAdminUserByID: Error: %v", result.Error)
		return nil, fmt.Errorf("failed to fetch admin user: %w", result.Error)
	}

	log.Printf("✓ GetAdminUserByID: Found user: %s (%s)", adminUser.Email, adminUser.Username)
	return &adminUser, nil
}

// GetProfileByID retrieves a single profile by ID
func (s *UserService) GetProfileByID(id string) (*models.Profile, error) {
	log.Printf("=== GetProfileByID: Looking for ID: %s ===", id)

	var profile models.Profile
	db := config.GetDB()

	result := db.First(&profile, "id = ?", id)
	if result.Error != nil {
		log.Printf("❌ GetProfileByID: Error: %v", result.Error)
		return nil, fmt.Errorf("failed to fetch profile: %w", result.Error)
	}

	log.Printf("✓ GetProfileByID: Found profile: %s", profile.Email)
	return &profile, nil
}

// GetProfilesWithPagination retrieves profiles with pagination support
func (s *UserService) GetProfilesWithPagination(page, pageSize int) ([]models.Profile, int64, error) {
	log.Printf("=== GetProfilesWithPagination: Page %d, PageSize %d ===", page, pageSize)

	var profiles []models.Profile
	var total int64

	db := config.GetDB()

	// Get total count
	if err := db.Model(&models.Profile{}).Count(&total).Error; err != nil {
		log.Printf("❌ GetProfilesWithPagination: Count error: %v", err)
		return nil, 0, fmt.Errorf("failed to count profiles: %w", err)
	}

	// Calculate offset
	offset := (page - 1) * pageSize

	// Get paginated results
	result := db.Offset(offset).Limit(pageSize).Find(&profiles)
	if result.Error != nil {
		log.Printf("❌ GetProfilesWithPagination: Query error: %v", result.Error)
		return nil, 0, fmt.Errorf("failed to fetch profiles: %w", result.Error)
	}

	log.Printf("✓ GetProfilesWithPagination: Found %d of %d total profiles", len(profiles), total)
	return profiles, total, nil
}

// GetAdminUsersWithPagination retrieves admin users with pagination support
func (s *UserService) GetAdminUsersWithPagination(page, pageSize int) ([]models.AdminUser, int64, error) {
	log.Printf("=== GetAdminUsersWithPagination: Page %d, PageSize %d ===", page, pageSize)

	var adminUsers []models.AdminUser
	var total int64

	db := config.GetDB()

	// Get total count
	if err := db.Model(&models.AdminUser{}).Count(&total).Error; err != nil {
		log.Printf("❌ GetAdminUsersWithPagination: Count error: %v", err)
		return nil, 0, fmt.Errorf("failed to count admin users: %w", err)
	}

	// Calculate offset
	offset := (page - 1) * pageSize

	// Get paginated results
	result := db.Offset(offset).Limit(pageSize).Find(&adminUsers)
	if result.Error != nil {
		log.Printf("❌ GetAdminUsersWithPagination: Query error: %v", result.Error)
		return nil, 0, fmt.Errorf("failed to fetch admin users: %w", result.Error)
	}

	log.Printf("✓ GetAdminUsersWithPagination: Found %d of %d total admin users", len(adminUsers), total)
	return adminUsers, total, nil
}
