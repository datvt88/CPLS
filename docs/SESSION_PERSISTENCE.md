# 🔐 Session Persistence & Cookie Management

Tài liệu này mô tả cách hệ thống quản lý session và cookie để tránh bị logout liên tục.

## 🎯 Vấn đề đã giải quyết

- ❌ Bị logout sau vài phút
- ❌ Mất session khi chuyển trang
- ❌ Token hết hạn không được refresh tự động
- ❌ Session không persist khi reload trang

## ✅ Giải pháp

### 1. Custom Cookie Storage

**File:** `/lib/supabaseClient.ts`

Tạo `CookieStorage` class để lưu session vào **cookie** thay vì chỉ localStorage:

**Ưu điểm:**
- ✅ Cookie tồn tại 30 ngày
- ✅ Tự động gửi kèm request (HttpOnly ready)
- ✅ Bảo mật hơn với SameSite=Lax và Secure flag
- ✅ Fallback về localStorage nếu cookie bị block

**Cấu hình:**
```typescript
const cookieStorage = new CookieStorage('cpls-auth-token')

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,      // Lưu session
    autoRefreshToken: true,    // Auto refresh trước khi hết hạn
    storage: cookieStorage,    // Custom storage
    flowType: 'pkce',          // PKCE flow (bảo mật hơn)
  }
})
```

---

### 2. Session Keepalive

**File:** `/components/AuthListener.tsx`

Tự động refresh token mỗi **50 phút** (token Supabase hết hạn sau 60 phút):

**Cơ chế:**
```typescript
// Refresh token mỗi 50 phút
setInterval(() => {
  await supabase.auth.refreshSession()
}, 50 * 60 * 1000)
```

**Logs:**
- `🔐 Session keepalive started` - Bắt đầu keepalive
- `🔄 Refreshing session...` - Đang refresh
- `✅ Session refreshed successfully` - Refresh thành công
- `🔓 Session keepalive stopped` - Dừng keepalive (logout)

---

### 3. Middleware Protection

**File:** `/middleware.ts`

Kiểm tra session **trước khi** vào protected routes:

**Protected Routes:**
- `/dashboard`
- `/stocks`
- `/market`
- `/signals`
- `/chat`
- `/profile`
- `/management`
- `/admin`

**Logic:**
```typescript
if (isProtectedRoute && !hasAuthToken) {
  // Redirect to login with return URL
  redirect('/login?redirect=/dashboard')
}
```

---

### 4. Session Hooks

**File:** `/hooks/useSession.ts`

Custom hooks để dễ dàng check session trong components:

**Usage:**
```typescript
// Get full session info
const { session, user, loading, isAuthenticated } = useSession()

// Just check auth status
const { isAuthenticated, loading } = useAuth()
```

**Example:**
```typescript
function MyComponent() {
  const { user, loading } = useSession()

  if (loading) return <Spinner />
  if (!user) return <LoginPrompt />

  return <Dashboard user={user} />
}
```

---

## 🔄 Session Lifecycle

```
User Login
    ↓
1. Supabase creates session (60 min expiry)
    ↓
2. Save to Cookie + localStorage (30 days)
    ↓
3. AuthListener starts keepalive (refresh every 50 min)
    ↓
4. User navigates pages
    ↓
5. Middleware checks cookie on each navigation
    ↓
6. Session refreshed automatically before expiry
    ↓
7. Keepalive continues until logout
```

---

## 🛠️ Troubleshooting

### Session vẫn bị mất?

**1. Kiểm tra cookie trong DevTools:**
```
Application → Cookies → localhost
- Tìm: cpls-auth-token
- Expire: 30 days
```

**2. Kiểm tra console logs:**
```
🔐 Session keepalive started
✅ Token refreshed successfully
```

**3. Kiểm tra localStorage:**
```javascript
localStorage.getItem('cpls-auth-token')
// Should return session data
```

### Cookie không được lưu?

**Nguyên nhân:**
- Browser blocking third-party cookies
- Extension chặn cookies (Privacy Badger, uBlock)

**Giải pháp:**
- Thử incognito mode
- Tắt privacy extensions tạm thời
- Fallback về localStorage sẽ tự động kích hoạt

### Token không refresh?

**Kiểm tra:**
1. AuthListener có được mount không?
2. Console có log refresh không?
3. Supabase env variables có đúng không?

**Debug:**
```typescript
// Force refresh manually
import { refreshSession } from '@/lib/supabaseClient'
await refreshSession()
```

---

## 🔒 Security Features

### Cookie Security

```typescript
// Set cookie with security flags
document.cookie =
  name + '=' + value +
  '; expires=' + date.toUTCString() +
  '; path=/' +
  '; Secure' +              // HTTPS only (production)
  '; SameSite=Lax'          // CSRF protection
```

### PKCE Flow

```typescript
flowType: 'pkce'  // Proof Key for Code Exchange
```

**Benefits:**
- Bảo vệ khỏi authorization code interception
- Không cần client secret
- An toàn hơn cho SPA

---

## 📊 Session Metrics

### Token Expiry Times

| Storage | Expiry |
|---------|--------|
| Access Token | 60 minutes |
| Refresh Token | 30 days |
| Cookie | 30 days |
| localStorage | Forever (manual clear) |

### Refresh Schedule

- **Manual Refresh**: User action (login, navigate)
- **Auto Refresh**: Every 50 minutes
- **On-Demand**: Before API calls if expired

---

## 🧪 Testing

### Test Session Persistence

1. Login vào webapp
2. Đợi 5 phút → Refresh page
3. Check: Vẫn đăng nhập ✅
4. Đợi 55 phút → Check console
5. Thấy: "✅ Session refreshed" ✅

### Test Cookie Storage

```javascript
// Open console
document.cookie.split(';').find(c => c.includes('cpls-auth-token'))
// Should return: "cpls-auth-token={...}"
```

### Test Middleware

```javascript
// Logout
await supabase.auth.signOut()

// Try to access protected route
window.location.href = '/dashboard'

// Should redirect to: /login?redirect=/dashboard
```

---

## 📚 API Reference

### Helper Functions

```typescript
// Check if authenticated
await isAuthenticated() // boolean

// Get current user
await getCurrentUser() // User | null

// Refresh session manually
await refreshSession() // Session | null
```

### Hooks

```typescript
// Full session info
const { session, user, loading, isAuthenticated } = useSession()

// Just auth status
const { isAuthenticated, loading } = useAuth()
```

---

## 🎉 Kết quả

Sau khi implement các tính năng trên:

✅ Session persist 30 ngày
✅ Auto refresh mỗi 50 phút
✅ Không bị logout khi chuyển trang
✅ Cookie + localStorage dual storage
✅ Middleware protection
✅ Better UX với loading states

---

**Version:** 1.0
**Last Updated:** 2025-12-02
