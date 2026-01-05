# Session Management Implementation - Quick Reference

## Vấn Đề (Problem)

Khi deploy lên Cloud Run, session-based authentication bị **Login Loop**:
- ✅ Login thành công
- ❌ Session không được lưu/đọc đúng
- 🔄 Redirect lại trang login liên tục

## Nguyên Nhân (Root Causes)

1. **Proxy Configuration**: Cloud Run dùng Load Balancer → App không tin tưởng proxy
2. **Cookie Secure**: App chạy HTTP nội bộ, nhưng cần cookie `Secure=true` cho HTTPS
3. **Session Secret**: Random key mỗi lần restart → session cũ mất
4. **Cookie Domain**: Config domain sai → cookie không gửi/nhận đúng

## Giải Pháp (Solution)

### 1. Trust Proxies

```go
// QUAN TRỌNG: Cho phép Gin tin tưởng proxy của Cloud Run
router.SetTrustedProxies(nil)
```

### 2. Session Configuration

```go
// Lấy SESSION_SECRET từ environment
sessionSecret := os.Getenv("SESSION_SECRET")
if sessionSecret == "" {
    sessionSecret = "default-secret-change-in-production"
}

store := cookie.NewStore([]byte(sessionSecret))

// Config cho Cloud Run HTTPS
store.Options(sessions.Options{
    Path:     "/",
    Domain:   "",                      // Empty = work với *.run.app
    MaxAge:   86400 * 7,              // 7 ngày
    Secure:   true,                    // BẮT BUỘC cho HTTPS
    HttpOnly: true,                    // Chống XSS
    SameSite: http.SameSiteLaxMode,   // Chống CSRF
})

router.Use(sessions.Sessions("admin_session", store))
```

### 3. Environment Variables

```bash
# Tạo session secret (một lần duy nhất, dùng mãi)
openssl rand -base64 32

# Set trong Cloud Run
gcloud run services update your-service \
  --set-env-vars SESSION_SECRET="your-secret-here" \
  --set-env-vars ADMIN_USERNAME="admin" \
  --set-env-vars ADMIN_PASSWORD="secure-password"
```

## Các Thay Đổi Chính (Main Changes)

### 1. `main.go`

```go
// Thêm imports
import (
    "net/http"
    "github.com/gin-contrib/sessions"
    "github.com/gin-contrib/sessions/cookie"
    "github.com/datvt88/CPLS/backend/middleware"
)

// Trong func main():
router.SetTrustedProxies(nil)                    // Trust proxy
router.LoadHTMLGlob("templates/*")               // Load templates
// ... session config như trên
router.Use(sessions.Sessions("admin_session", store))

// Admin routes
admin := router.Group("/admin")
{
    admin.GET("/login", adminController.ShowLoginPage)
    admin.POST("/login", adminController.ProcessLogin)
    admin.GET("/dashboard", middleware.AuthRequired(), adminController.ShowDashboard)
    admin.GET("/logout", middleware.AuthRequired(), adminController.Logout)
}
```

### 2. `middleware/auth.go` (New)

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

### 3. `controllers/admin_controller.go` (New)

Controllers cho login, dashboard, logout với session management

### 4. Templates (New)

- `templates/login.html`
- `templates/dashboard.html`

## Testing Local

```bash
# Set env vars
export SESSION_SECRET="local-test-secret"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="admin123"
export MONGODB_URI="your-mongodb-uri"

# Run
cd backend
go run main.go

# Test
open http://localhost:8080/admin/login
```

## Deploy to Cloud Run

```bash
# Option 1: Direct env vars
gcloud run deploy cpls-crawler \
  --image gcr.io/$PROJECT_ID/cpls-crawler \
  --set-env-vars SESSION_SECRET="$(openssl rand -base64 32)" \
  --set-env-vars ADMIN_USERNAME="admin" \
  --set-env-vars ADMIN_PASSWORD="secure-password"

# Option 2: Using Secret Manager (Recommended)
echo -n "$(openssl rand -base64 32)" | gcloud secrets create session-secret --data-file=-

gcloud run deploy cpls-crawler \
  --image gcr.io/$PROJECT_ID/cpls-crawler \
  --set-secrets SESSION_SECRET=session-secret:latest
```

## Troubleshooting

### Vẫn bị Login Loop?

1. ✅ Check `router.SetTrustedProxies(nil)` đã thêm chưa?
2. ✅ Check `Secure: true` trong session options
3. ✅ Check `SESSION_SECRET` environment variable đã set chưa?
4. ✅ Check logs: `gcloud run services logs read cpls-crawler --limit 50`

### Session mất sau khi restart?

→ Chưa set `SESSION_SECRET` environment variable!

### Cookie không được set?

→ Check browser DevTools → Application → Cookies

## Các File Thay Đổi

```
backend/
├── main.go                          # ✏️ Modified
├── go.mod                           # ✏️ Modified (added gin-contrib/sessions)
├── .env.example                     # ✏️ Modified (added SESSION_SECRET, ADMIN_*)
├── controllers/
│   └── admin_controller.go         # ✨ New
├── middleware/
│   └── auth.go                     # ✨ New
└── templates/
    ├── login.html                  # ✨ New
    └── dashboard.html              # ✨ New
```

## Key Points

| Setting | Value | Tại sao? |
|---------|-------|----------|
| `SetTrustedProxies(nil)` | Trust all | Cloud Run proxy an toàn |
| `Secure: true` | Bật | HTTPS của Cloud Run |
| `HttpOnly: true` | Bật | Chống XSS |
| `SameSite: Lax` | Lax | Cân bằng security & UX |
| `Domain: ""` | Rỗng | Work với *.run.app |
| `SESSION_SECRET` | Env var | Persistent key |

## Documentation

- 📖 [Full Session Guide](./CLOUD_RUN_SESSION_GUIDE.md) - Chi tiết đầy đủ
- 📖 [Cloud Run Deployment](./CLOUD_RUN_DEPLOYMENT.md) - Hướng dẫn deploy
- 📖 [Gin Sessions](https://github.com/gin-contrib/sessions) - Library docs

## Routes

| Route | Method | Auth | Mô tả |
|-------|--------|------|-------|
| `/admin/login` | GET | ❌ | Trang login |
| `/admin/login` | POST | ❌ | Xử lý login |
| `/admin/dashboard` | GET | ✅ | Dashboard |
| `/admin/logout` | GET | ✅ | Logout |
| `/health` | GET | ❌ | Health check |
| `/api/crawler/*` | * | ❌ | API endpoints |

---

**Lưu ý**: Đổi default credentials (`admin/admin123`) trong production!
