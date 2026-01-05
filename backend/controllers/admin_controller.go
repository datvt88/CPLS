package controllers

import (
	"net/http"
	"os"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type AdminController struct{}

func NewAdminController() *AdminController {
	return &AdminController{}
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
