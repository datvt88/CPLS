# 🔍 Debug OAuth Callback - Hướng dẫn kiểm tra

## ✅ Đã sửa lỗi

Callback page đã được cập nhật để **phân biệt chính xác** Google OAuth và Zalo OAuth.

**Trước (Lỗi):**
```
❌ Lỗi: "Không nhận được authorization code từ Zalo"
   → Callback nhầm Google OAuth là Zalo
```

**Sau (Fixed):**
```
✅ Callback tự động nhận diện đúng provider
✅ Xử lý Google OAuth với hash fragments
✅ Xử lý Zalo OAuth với query parameters
✅ Retry logic nếu session chưa sẵn sàng
```

---

## 🧪 Cách kiểm tra Google OAuth

### Bước 1: Mở Browser Console

1. Mở trình duyệt (Chrome/Edge/Firefox)
2. Nhấn **F12** để mở DevTools
3. Click tab **Console**

### Bước 2: Test đăng nhập

1. Truy cập `http://localhost:3000` (hoặc `https://beta.cophieuluotsong.com`)
2. Click nút **"Đăng nhập bằng Google"**
3. Chọn tài khoản Google và approve

### Bước 3: Xem Console Logs

Nếu **thành công**, bạn sẽ thấy logs theo thứ tự:

```
🔍 Callback page loaded
URL: http://localhost:3000/auth/callback#access_token=...
Hash: #access_token=eyJhbGci...
Search:

Parameters: {
  hasAccessToken: true,
  hasCode: false,
  hasState: false,
  hasError: false
}

🔑 Processing Supabase OAuth (Google)
🔐 Setting up Supabase session...
✅ Session set successfully
✅ Google OAuth session established: {
  user_id: "uuid...",
  email: "user@gmail.com",
  provider: "google"
}
```

### Bước 4: Kiểm tra redirect

Sau logs trên, bạn sẽ:
1. Thấy màn hình "Đăng nhập thành công!" với icon ✅
2. Tự động redirect về `/dashboard` sau 1.5 giây
3. URL clean: `http://localhost:3000/dashboard` (không có hash)

---

## ❌ Nếu gặp lỗi

### Lỗi 1: "No session found after OAuth callback"

**Console logs:**
```
🔍 Callback page loaded
🔑 Processing Supabase OAuth (Google)
🔐 Setting up Supabase session...
❌ Supabase OAuth error: No session found after OAuth callback
```

**Nguyên nhân:**
- Supabase chưa xử lý xong callback
- Network lag

**Giải pháp:**
Code đã có retry logic. Nếu vẫn lỗi:
1. Check network tab (F12 → Network)
2. Tìm request đến `supabase.co/auth/v1/token`
3. Xem response có lỗi không

---

### Lỗi 2: "Unsupported provider: provider is not enabled"

**Console logs:**
```
❌ OAuth error: {"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

**Nguyên nhân:**
Google Provider chưa được enable trong Supabase.

**Giải pháp:**
Xem file `SUPABASE_GOOGLE_SETUP_QUICKSTART.md` - Bước 2

---

### Lỗi 3: "redirect_uri_mismatch"

**Console logs:**
```
❌ OAuth error: redirect_uri_mismatch
```

**Nguyên nhân:**
Redirect URI không match với Google Cloud Console.

**Giải pháp:**
1. Mở Google Cloud Console
2. **Credentials** → OAuth 2.0 Client ID
3. Thêm vào **Authorized redirect URIs**:
   ```
   https://YOUR-PROJECT.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   ```

---

### Lỗi 4: Vẫn thấy "Không nhận được authorization code từ Zalo"

**Console logs:**
```
🔍 Callback page loaded
URL: http://localhost:3000/auth/callback
Hash:
Search:

Parameters: {
  hasAccessToken: false,
  hasCode: false,
  hasState: false,
  hasError: false
}

⏳ Waiting for Supabase to process callback...
❌ No valid authentication parameters found
❌ Không tìm thấy thông tin xác thực. Vui lòng thử lại.
```

**Nguyên nhân:**
- Callback page load mà không có parameters
- User vào trực tiếp `/auth/callback` (không phải từ OAuth)

**Giải pháp:**
Đây là **bình thường** nếu bạn vào trực tiếp URL. Chỉ vào callback page từ OAuth flow.

---

## 🔍 Chi tiết 5-Step Detection

Code callback sử dụng **5 bước** để detect OAuth:

### STEP 1: Check Existing Session
```typescript
const { data: { session: existingSession } } = await supabase.auth.getSession()

if (existingSession) {
  // Session đã có sẵn → Success!
}
```

**Khi nào xảy ra:**
- User đã đăng nhập trước đó
- Session được restore từ localStorage

---

### STEP 2: Check Hash Fragments (Google OAuth)
```typescript
const hashParams = new URLSearchParams(window.location.hash.substring(1))
const accessToken = hashParams.get('access_token')

if (accessToken) {
  // Google OAuth → Process hash
}
```

**URL mẫu:**
```
http://localhost:3000/auth/callback#access_token=xxx&refresh_token=yyy
```

---

### STEP 3: Check Query Parameters (Zalo OAuth)
```typescript
const urlParams = new URLSearchParams(window.location.search)
const code = urlParams.get('code')
const state = urlParams.get('state')

if (code && state) {
  // Zalo OAuth → Process code
}
```

**URL mẫu:**
```
http://localhost:3000/auth/callback?code=xxx&state=yyy
```

---

### STEP 4: Route to Handler

Dựa vào parameters, chọn handler phù hợp:
- `handleSupabaseOAuth()` - Google
- `handleZaloOAuth()` - Zalo

---

### STEP 5: Retry with Delay

Nếu không có parameters:
```typescript
await new Promise(resolve => setTimeout(resolve, 1000))
const { data: { session: delayedSession } } = await supabase.auth.getSession()

if (delayedSession) {
  // Session có sau khi đợi → Success!
}
```

**Tại sao cần retry?**
- Supabase cần thời gian process callback
- Network có thể lag
- Race condition giữa redirect và session setup

---

## 📊 Flow Chart

```
User clicks "Đăng nhập bằng Google"
    ↓
Redirect to Google OAuth
    ↓
User approves
    ↓
Google redirects to Supabase
    ↓
Supabase processes OAuth
    ↓
Supabase redirects to:
  /auth/callback#access_token=xxx
    ↓
Callback page loads
    ↓
STEP 1: Check existing session → No
    ↓
STEP 2: Check hash → Yes! (accessToken found)
    ↓
STEP 4: handleSupabaseOAuth()
    ↓
setSession(accessToken, refreshToken)
    ↓
getSession() → Verify
    ↓
Profile auto-created (AuthListener + DB trigger)
    ↓
Clean URL hash
    ↓
Redirect to /dashboard
    ↓
✅ Success!
```

---

## 🎯 Checklist Debug

Khi gặp lỗi, check theo thứ tự:

**Google Cloud Console:**
- [ ] OAuth Client ID đã tạo?
- [ ] Redirect URIs đã thêm?
- [ ] JavaScript origins đã thêm?

**Supabase Dashboard:**
- [ ] Google Provider đã enable?
- [ ] Client ID đã paste?
- [ ] Client Secret đã paste?
- [ ] Site URL đã set?
- [ ] Redirect URLs đã thêm?

**Database:**
- [ ] Bảng `profiles` đã tạo?
- [ ] Trigger `on_auth_user_created` tồn tại?
- [ ] Function `handle_new_user()` tồn tại?

**Code:**
- [ ] File `app/auth/callback/page.tsx` đã update?
- [ ] File `components/AuthListener.tsx` đã update?
- [ ] File `services/auth.service.ts` có `signInWithGoogle()`?

**Browser:**
- [ ] Console có logs đầy đủ?
- [ ] Network tab không có lỗi 4xx/5xx?
- [ ] Cookies được enable?
- [ ] Third-party cookies được allow?

---

## 💡 Tips

### Enable verbose logging

Để thấy nhiều logs hơn, set trong localStorage:

```javascript
// Mở console và chạy:
localStorage.setItem('supabase.auth.debug', 'true')

// Reload page
location.reload()
```

### Clear all sessions

Nếu muốn test lại từ đầu:

```javascript
// Xóa session hiện tại
await supabase.auth.signOut()

// Clear storage
localStorage.clear()
sessionStorage.clear()

// Reload
location.reload()
```

### Test trên Incognito

Để tránh cache và session cũ:
1. Mở Incognito/Private window (Ctrl+Shift+N)
2. Test OAuth flow
3. Đóng window sau khi xong

---

## 📞 Support

Nếu vẫn gặp lỗi sau khi check tất cả:

1. **Copy console logs** (toàn bộ)
2. **Copy URL** khi lỗi xảy ra
3. **Screenshot** màn hình lỗi
4. Report issue với thông tin trên

---

**Version:** 2.0 - Enhanced Detection
**Last Updated:** 2025-01-20
**Status:** ✅ Production Ready
