package controllers

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/datvt88/CPLS/backend/services"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type AdminController struct{
	userService *services.UserService
}

func NewAdminController() *AdminController {
	return &AdminController{
		userService: services.NewUserService(),
	}
}

// ShowLoginPage renders the login page
func (ac *AdminController) ShowLoginPage(c *gin.Context) {
	// Check if already logged in
	session := sessions.Default(c)
	user := session.Get("user")
	if user != nil {
		c.Redirect(http.StatusFound, "/admin/dashboard")
		return
	}

	// Render login page (simple HTML for demonstration)
	c.HTML(http.StatusOK, "login.html", gin.H{
		"title": "Admin Login",
	})
}

// ProcessLogin handles login form submission
func (ac *AdminController) ProcessLogin(c *gin.Context) {
	session := sessions.Default(c)

	username := c.PostForm("username")
	password := c.PostForm("password")

	// Simple authentication (in production, use proper password hashing)
	adminUser := os.Getenv("ADMIN_USERNAME")
	adminPass := os.Getenv("ADMIN_PASSWORD")

	if adminUser == "" {
		adminUser = "admin"
	}
	if adminPass == "" {
		adminPass = "admin123"
	}

	if username == adminUser && password == adminPass {
		// Set user in session
		session.Set("user", username)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to save session",
			})
			return
		}

		c.Redirect(http.StatusFound, "/admin/dashboard")
	} else {
		c.HTML(http.StatusUnauthorized, "login.html", gin.H{
			"title": "Admin Login",
			"error": "Invalid username or password",
		})
	}
}

// ShowDashboard renders the admin dashboard
func (ac *AdminController) ShowDashboard(c *gin.Context) {
	session := sessions.Default(c)
	user := session.Get("user")

	c.HTML(http.StatusOK, "dashboard.html", gin.H{
		"title": "Admin Dashboard",
		"user":  user,
	})
}

// Logout handles user logout
func (ac *AdminController) Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	if err := session.Save(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to clear session",
		})
		return
	}

	c.Redirect(http.StatusFound, "/admin/login")
}

// GetAdminUsers returns all admin users (JSON API)
func (ac *AdminController) GetAdminUsers(c *gin.Context) {
	log.Println("=== AdminController.GetAdminUsers: API called ===")

	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	var adminUsers []interface{}
	var total int64

	// If pagination is requested (page > 1 or page_size specified)
	if page > 1 || c.Query("page_size") != "" {
		users, count, paginateErr := ac.userService.GetAdminUsersWithPagination(page, pageSize)
		if paginateErr != nil {
			log.Printf("❌ GetAdminUsers: Error fetching paginated admin users: %v", paginateErr)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch admin users",
				"details": paginateErr.Error(),
			})
			return
		}
		adminUsers = make([]interface{}, len(users))
		for i, u := range users {
			adminUsers[i] = u
		}
		total = count
	} else {
		// Get all users without pagination
		users, allErr := ac.userService.GetAdminUsers()
		if allErr != nil {
			log.Printf("❌ GetAdminUsers: Error fetching admin users: %v", allErr)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch admin users",
				"details": allErr.Error(),
			})
			return
		}
		adminUsers = make([]interface{}, len(users))
		for i, u := range users {
			adminUsers[i] = u
		}
		total = int64(len(users))
	}

	log.Printf("✓ GetAdminUsers: Returning %d admin users (total: %d)", len(adminUsers), total)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    adminUsers,
		"total":   total,
		"page":    page,
		"page_size": pageSize,
	})
}

// GetProfiles returns all user profiles (JSON API)
func (ac *AdminController) GetProfiles(c *gin.Context) {
	log.Println("=== AdminController.GetProfiles: API called ===")

	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "50"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}

	var profiles []interface{}
	var total int64

	// If pagination is requested (page > 1 or page_size specified)
	if page > 1 || c.Query("page_size") != "" {
		profs, count, paginateErr := ac.userService.GetProfilesWithPagination(page, pageSize)
		if paginateErr != nil {
			log.Printf("❌ GetProfiles: Error fetching paginated profiles: %v", paginateErr)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch profiles",
				"details": paginateErr.Error(),
			})
			return
		}
		profiles = make([]interface{}, len(profs))
		for i, p := range profs {
			profiles[i] = p
		}
		total = count
	} else {
		// Get all profiles without pagination
		profs, allErr := ac.userService.GetProfiles()
		if allErr != nil {
			log.Printf("❌ GetProfiles: Error fetching profiles: %v", allErr)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to fetch profiles",
				"details": allErr.Error(),
			})
			return
		}
		profiles = make([]interface{}, len(profs))
		for i, p := range profs {
			profiles[i] = p
		}
		total = int64(len(profs))
	}

	log.Printf("✓ GetProfiles: Returning %d profiles (total: %d)", len(profiles), total)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    profiles,
		"total":   total,
		"page":    page,
		"page_size": pageSize,
	})
}
