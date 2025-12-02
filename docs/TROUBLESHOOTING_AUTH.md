# 🐛 Troubleshooting: "Đang xác thực..." Hang Issue

## ❌ Vấn đề

Trang bị **"Đang xác thực... Vui lòng đợi trong giây lát"** và không bao giờ load xong.

## ✅ Đã Fix

**Commit:** `fix: Resolve authentication hang issue`

### Nguyên nhân:

1. **Middleware conflict**: Middleware redirect trước khi component check session
2. **Race conditions**: Multiple session checks chạy đồng thời
3. **Duplicate intervals**: Keepalive start nhiều lần
4. **Timeout quá lâu**: 10s timeout gây UX xấu

### Giải pháp:

1. **Middleware** - Chỉ log, không redirect
2. **ProtectedRoute** - Handle auth logic và redirect
3. **AuthListener** - Prevent duplicate intervals
4. **Timeout** - Giảm từ 10s → 5s

---

## 🔍 Debug Steps

Nếu vẫn gặp vấn đề, làm theo các bước sau:

### Bước 1: Mở Browser Console

**Chrome/Edge:**
- Press `F12` hoặc `Ctrl + Shift + I`
- Vào tab **Console**

**Safari:**
- Enable Developer menu: Preferences → Advanced → Show Develop menu
- Press `Cmd + Option + C`

### Bước 2: Check Console Logs

Khi bị treo "Đang xác thực...", check các logs:

```
✅ Good logs (normal flow):
🔍 ProtectedRoute: Checking auth...
✅ ProtectedRoute: Session found - user@example.com...
✅ Access granted (no premium required)

❌ Bad logs (có vấn đề):
⏱️ ProtectedRoute: Auth check timeout after 5s
❌ Timeout with no session - redirecting to login
```

### Bước 3: Check Cookie

**DevTools → Application Tab → Cookies**

Kiểm tra cookie `cpls-auth-token`:
- ✅ **Có cookie** → Session được lưu
- ❌ **Không có cookie** → Session bị mất

```javascript
// Hoặc check bằng console
document.cookie.split(';').find(c => c.includes('cpls-auth-token'))
// Should return: " cpls-auth-token=eyJ..."
```

### Bước 4: Check localStorage

**DevTools → Application Tab → Local Storage**

Kiểm tra `cpls-auth-token`:
```javascript
// Check bằng console
localStorage.getItem('cpls-auth-token')
// Should return: '{"access_token":"eyJ...", ...}'
```

### Bước 5: Check Network

**DevTools → Network Tab**

Filter: `getSession`

- ✅ **Status 200** → API hoạt động
- ❌ **Status 401/403** → Auth failed
- ❌ **Status 500** → Server error
- ❌ **Failed/Pending** → Network issue

---

## 🛠️ Common Fixes

### Fix 1: Clear Cache & Cookies

```bash
1. Press Ctrl + Shift + Delete (Chrome/Edge)
2. Select "Cookies and other site data"
3. Select "Cached images and files"
4. Click "Clear data"
5. Refresh page (Ctrl + F5)
```

### Fix 2: Hard Refresh

```bash
# Windows/Linux
Ctrl + F5

# Mac
Cmd + Shift + R
```

### Fix 3: Logout & Login Again

```javascript
// Open console and run:
await supabase.auth.signOut()
// Then login again
```

### Fix 4: Check Supabase Status

Vào: https://status.supabase.com/

- ✅ All systems operational
- ❌ Incident detected → Wait for fix

### Fix 5: Disable Browser Extensions

Tạm thời tắt extensions có thể block cookies:
- Privacy Badger
- uBlock Origin
- AdBlock Plus
- Cookie AutoDelete

**Test in Incognito Mode:**
- Chrome: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`

---

## 📊 Debug Commands

### Check Session in Console

```javascript
// Get current session
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)

// Check if authenticated
const isAuth = await isAuthenticated()
console.log('Is Authenticated:', isAuth)

// Get user
const user = await getCurrentUser()
console.log('User:', user)

// Force refresh
const newSession = await refreshSession()
console.log('New Session:', newSession)
```

### Check Cookies

```javascript
// Get all cookies
document.cookie.split(';').forEach(c => console.log(c.trim()))

// Get auth cookie specifically
const authCookie = document.cookie
  .split(';')
  .find(c => c.trim().startsWith('cpls-auth-token='))
console.log('Auth Cookie:', authCookie)
```

### Check localStorage

```javascript
// Get all keys
Object.keys(localStorage).forEach(key => {
  console.log(key, ':', localStorage.getItem(key)?.slice(0, 50))
})

// Check auth token
const token = localStorage.getItem('cpls-auth-token')
if (token) {
  const parsed = JSON.parse(token)
  console.log('Token expires:', new Date(parsed.expires_at * 1000))
}
```

---

## 🔄 Authentication Flow

```
User visits /dashboard
    ↓
Middleware: Check cookie (no redirect)
    ↓
ProtectedRoute: Check session
    ↓
    ├─ No session → Redirect to /login
    │
    ├─ Has session → Check premium (if needed)
    │   ├─ Premium OK → Show page
    │   └─ No premium → Redirect to /upgrade
    │
    └─ Timeout (5s) →
        ├─ Has valid session → Grant access
        └─ No session → Redirect to /login
```

---

## 📝 Expected Console Logs

### Successful Login Flow:

```
Auth state changed: SIGNED_IN
✅ Profile synced successfully for user: 12345678
🔐 Session keepalive started (refresh every 50 min)
🔍 ProtectedRoute: Checking auth...
✅ ProtectedRoute: Session found - user@example.com...
✅ Access granted (no premium required)
```

### Session Refresh:

```
🔄 Refreshing session...
✅ Token refreshed successfully
Auth state changed: TOKEN_REFRESHED
```

### Logout:

```
Auth state changed: SIGNED_OUT
🔓 Session keepalive stopped
```

---

## 🚨 Error Patterns

### Pattern 1: Infinite Loop

```
🔍 ProtectedRoute: Checking auth...
❌ ProtectedRoute: No session found
🔍 ProtectedRoute: Checking auth...
❌ ProtectedRoute: No session found
```

**Fix:** Clear cookies & localStorage, login again

### Pattern 2: Timeout

```
🔍 ProtectedRoute: Checking auth...
⏱️ ProtectedRoute: Auth check timeout after 5s
❌ Timeout with no session - redirecting to login
```

**Fix:** Check network, check Supabase status

### Pattern 3: 401 Unauthorized

```
❌ Profile error: {code: "401", message: "Unauthorized"}
```

**Fix:** Token expired, logout & login again

---

## 🔐 Security Notes

### Cookie Settings

Cookies được set với:
- `Secure` flag (HTTPS only in production)
- `SameSite=Lax` (CSRF protection)
- `Max-Age=2592000` (30 days)

### LocalStorage Fallback

Nếu cookies bị block:
- Automatically fallback to localStorage
- Session vẫn persist
- Security giảm một chút nhưng vẫn hoạt động

---

## 📞 Báo lỗi

Nếu vẫn không fix được, báo lỗi kèm theo:

1. **Console logs** (screenshot hoặc copy text)
2. **Network tab** (check request/response)
3. **Cookie/localStorage** status
4. **Browser** và **version**
5. **Các bước** đã thử

---

**Last Updated:** 2025-12-02
**Version:** 1.0
