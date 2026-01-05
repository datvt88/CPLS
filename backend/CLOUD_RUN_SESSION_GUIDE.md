# Cloud Run Session Management - Implementation Guide

## Overview

This document explains the session management implementation for the Admin Dashboard on Google Cloud Run. The implementation addresses the common login loop issue that occurs when deploying session-based authentication to Cloud Run.

## Problem Statement

When deploying a Go Gin application with session-based authentication to Google Cloud Run, users often experience a login loop where:

1. User enters correct credentials
2. Server authenticates successfully
3. Server sets cookie/session and redirects to dashboard
4. Browser loads dashboard, but server doesn't find session
5. Server redirects back to login page (infinite loop)

## Root Causes

### 1. **Proxy Configuration**
Cloud Run uses a load balancer (proxy) in front of your application. The app receives requests through this proxy, not directly from clients.

**Solution**: Configure Gin to trust proxies
```go
router.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"})
```
Note: In Gin v1.8.0+, `SetTrustedProxies(nil)` actually **disables** proxy trust. To trust all proxies (safe in Cloud Run's isolated environment), use the CIDR ranges above.

### 2. **HTTPS vs HTTP Mismatch**
- External: Client → Load Balancer (HTTPS)
- Internal: Load Balancer → App (HTTP)

Cookies with `Secure: true` only work on HTTPS. But since the app sees HTTP traffic internally, it might not set the cookie properly.

**Solution**: Configure session to use Secure cookies. Gin will detect the `X-Forwarded-Proto` header from the proxy and treat the connection as HTTPS.

```go
store.Options(sessions.Options{
    Secure: true,  // Works because of X-Forwarded-Proto header
})
```

### 3. **Session Secret Key**
If you use a random session secret that changes on each deployment/restart, all existing sessions become invalid.

**Solution**: Use a fixed session secret from environment variable
```go
sessionSecret := os.Getenv("SESSION_SECRET")
```

### 4. **Cookie Domain Configuration**
Incorrect domain settings can prevent cookies from being sent/received.

**Solution**: Leave domain empty for `*.run.app` domains
```go
Domain: "",  // Works for all subdomains including *.run.app
```

## Implementation Details

### 1. Session Middleware Configuration

```go
// Trust proxies for Cloud Run
// Trust all proxies (0.0.0.0/0 for IPv4, ::/0 for IPv6)
// This is safe in Cloud Run's isolated environment and required for HTTPS detection
router.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"})

// Get session secret from environment
sessionSecret := os.Getenv("SESSION_SECRET")
if sessionSecret == "" {
    log.Println("WARNING: SESSION_SECRET not set")
    sessionSecret = "default-secret-change-in-production"
}

// Create cookie store
store := cookie.NewStore([]byte(sessionSecret))

// Configure for Cloud Run HTTPS environment
store.Options(sessions.Options{
    Path:     "/",
    Domain:   "",                      // Empty for *.run.app domains
    MaxAge:   86400 * 7,               // 7 days
    Secure:   true,                    // HTTPS only (Cloud Run terminates HTTPS)
    HttpOnly: true,                    // Prevent JavaScript access (XSS protection)
    SameSite: http.SameSiteLaxMode,   // CSRF protection while allowing navigation
})

router.Use(sessions.Sessions("admin_session", store))
```

### 2. Authentication Middleware

```go
func AuthRequired() gin.HandlerFunc {
    return func(c *gin.Context) {
        session := sessions.Default(c)
        user := session.Get("user")
        
        if user == nil {
            c.Redirect(http.StatusFound, "/admin/login")
            c.Abort()
            return
        }
        
        c.Next()
    }
}
```

### 3. Login Handler

```go
func (ac *AdminController) ProcessLogin(c *gin.Context) {
    session := sessions.Default(c)
    
    username := c.PostForm("username")
    password := c.PostForm("password")
    
    // Authenticate user
    if username == adminUser && password == adminPass {
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
            "error": "Invalid username or password",
        })
    }
}
```

## Environment Variables

Set these variables in Cloud Run:

```bash
# Required: Session secret key (must be persistent across deployments)
SESSION_SECRET=your-strong-random-secret-here

# Optional: Admin credentials (defaults to admin/admin123)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

### Generating a Strong Session Secret

```bash
# Generate a random 32-byte base64 encoded secret
openssl rand -base64 32
```

## Deployment to Cloud Run

### 1. Set Environment Variables

Using gcloud CLI:
```bash
gcloud run deploy cpls-crawler \
  --image gcr.io/$PROJECT_ID/cpls-crawler \
  --platform managed \
  --region asia-southeast1 \
  --set-env-vars SESSION_SECRET="your-secret-here" \
  --set-env-vars ADMIN_USERNAME="admin" \
  --set-env-vars ADMIN_PASSWORD="secure-password"
```

### 2. Using Secret Manager (Recommended)

```bash
# Create secrets
echo -n "your-strong-session-secret" | gcloud secrets create session-secret --data-file=-
echo -n "your-admin-password" | gcloud secrets create admin-password --data-file=-

# Deploy with secrets
gcloud run deploy cpls-crawler \
  --image gcr.io/$PROJECT_ID/cpls-crawler \
  --platform managed \
  --region asia-southeast1 \
  --set-secrets SESSION_SECRET=session-secret:latest \
  --set-secrets ADMIN_PASSWORD=admin-password:latest \
  --set-env-vars ADMIN_USERNAME="admin"
```

## Testing

### 1. Local Testing

```bash
# Set environment variables
export SESSION_SECRET="local-test-secret"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="admin123"
export MONGODB_URI="your-mongodb-connection-string"

# Run the application
cd backend
go run main.go
```

Visit:
- http://localhost:8080/admin/login - Login page
- http://localhost:8080/admin/dashboard - Dashboard (requires login)

### 2. Cloud Run Testing

After deployment:
```bash
# Get your service URL
SERVICE_URL=$(gcloud run services describe cpls-crawler \
  --platform managed \
  --region asia-southeast1 \
  --format 'value(status.url)')

# Test login page
curl -L $SERVICE_URL/admin/login

# Test health check
curl $SERVICE_URL/health
```

## Security Best Practices

### 1. **Always Use Strong Session Secrets**
```bash
# Generate a new secret for each environment
openssl rand -base64 32
```

### 2. **Use Secret Manager**
Never store secrets in environment variables in the Cloud Run console. Use Secret Manager instead.

### 3. **Rotate Credentials Regularly**
Change admin passwords and session secrets periodically.

### 4. **Enable HTTPS Only**
Cloud Run enforces HTTPS by default, but ensure `Secure: true` is set on cookies.

### 5. **Set HttpOnly Flag**
Prevents JavaScript access to cookies (XSS protection):
```go
HttpOnly: true
```

### 6. **Use SameSite Protection**
Prevents CSRF attacks:
```go
SameSite: http.SameSiteLaxMode  // or http.SameSiteStrictMode for stricter protection
```

## Troubleshooting

### Login Loop Still Occurs

**Check 1: Verify Proxy Trust**
```go
// Should trust all proxies for Cloud Run
router.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"})
// NOT: router.SetTrustedProxies(nil) - this disables proxy trust!
```

**Check 2: Verify Secure Cookie**
```go
// Should be true
Secure: true
```

**Check 3: Check Cloud Run Logs**
```bash
gcloud run services logs read cpls-crawler --limit 50
```

Look for:
- "WARNING: SESSION_SECRET not set" - Set SESSION_SECRET
- Cookie errors - Check cookie configuration
- X-Forwarded-Proto headers - Verify proxy is working

### Session Lost After Restart

**Cause**: SESSION_SECRET not set or changes on restart

**Solution**: Set SESSION_SECRET environment variable in Cloud Run

### Cookies Not Being Set

**Check 1: Domain Setting**
```go
Domain: "",  // Empty is correct for Cloud Run
```

**Check 2: Path Setting**
```go
Path: "/",   // Should be root
```

**Check 3: Browser Console**
Open browser DevTools → Application → Cookies
Verify cookie is being set with correct attributes

## Key Configuration Summary

| Setting | Value | Reason |
|---------|-------|--------|
| `SetTrustedProxies` | `[]string{"0.0.0.0/0", "::/0"}` | Trust Cloud Run load balancer for HTTPS detection |
| `Secure` | `true` | HTTPS only (Cloud Run uses HTTPS) |
| `HttpOnly` | `true` | Prevent XSS attacks |
| `SameSite` | `Lax` | Balance security and usability |
| `Domain` | `""` | Works for *.run.app domains |
| `Path` | `"/"` | Cookie available for all routes |
| `MaxAge` | `86400 * 7` | 7 days session lifetime |

## Routes

| Route | Method | Authentication | Description |
|-------|--------|----------------|-------------|
| `/admin/login` | GET | Public | Show login page |
| `/admin/login` | POST | Public | Process login |
| `/admin/dashboard` | GET | Required | Show dashboard |
| `/admin/logout` | GET | Required | Logout user |
| `/health` | GET | Public | Health check |
| `/api/crawler/start` | POST | Public | Start crawler |
| `/api/crawler/status` | GET | Public | Get crawler status |

## Migration Guide

If you have an existing application with session issues:

1. **Add trust proxy configuration**
   ```go
   router.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"})
   ```

2. **Update session options**
   ```go
   store.Options(sessions.Options{
       Secure: true,
       HttpOnly: true,
       SameSite: http.SameSiteLaxMode,
       Domain: "",
   })
   ```

3. **Set SESSION_SECRET environment variable**
   ```bash
   gcloud run services update your-service \
     --set-env-vars SESSION_SECRET="your-secret"
   ```

4. **Redeploy your service**

## References

- [Gin Sessions Documentation](https://github.com/gin-contrib/sessions)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [HTTP Cookie Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [SameSite Cookie Explained](https://web.dev/samesite-cookies-explained/)
