package middleware

import (
	"net/http"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// AuthRequired middleware checks if user is authenticated
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		user := session.Get("user")
		
		if user == nil {
			// User not logged in, redirect to login page
			c.Redirect(http.StatusFound, "/admin/login")
			c.Abort()
			return
		}
		
		c.Next()
	}
}
