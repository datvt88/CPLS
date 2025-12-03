# Hướng dẫn cấu hình Session 8 giờ cho Supabase

## Vấn đề
User phải đăng nhập lại sau 1 giờ (mặc định của Supabase JWT expiry).

## Giải pháp
Tăng JWT expiry lên 8 giờ (28800 giây) và cấu hình auto-refresh token.

---

## 🔧 Bước 1: Cấu hình Supabase Dashboard (BẮT BUỘC)

### 1. Truy cập Supabase Dashboard
1. Đăng nhập vào https://supabase.com/dashboard
2. Chọn project của bạn

### 2. Thay đổi JWT Expiry Time

1. Vào **Settings** → **Authentication**
2. Tìm section **"JWT Expiry"** hoặc **"Session Settings"**
3. Thay đổi các giá trị sau:

| Setting | Giá trị mặc định | Giá trị mới (8h) | Mô tả |
|---------|------------------|------------------|-------|
| **JWT Expiry** | `3600` (1 giờ) | `28800` (8 giờ) | Thời gian access token hết hạn |
| **Refresh Token Expiry** | `2592000` (30 ngày) | Giữ nguyên | Thời gian refresh token hết hạn |
| **JWT Refresh Margin** | Tùy chọn | `300` (5 phút) | Refresh trước khi expire |

**Screenshot vị trí:**
```
Settings → Authentication
├── JWT Expiry (seconds): 28800
├── Refresh Token Expiry (seconds): 2592000
└── Auto Refresh Tokens: Enabled
```

### 3. Lưu thay đổi

Nhấn **Save** và đợi vài giây để settings áp dụng.

**Lưu ý:** Không cần redeploy app sau khi thay đổi JWT settings.

---

## ✅ Bước 2: Verify Code Configuration

Code đã được cấu hình sẵn để:
- ✅ Auto-refresh token trước khi expire
- ✅ Persist session trong cookie/localStorage
- ✅ Cookie expiry match với JWT expiry (8h)

**File đã được cập nhật:**
- `lib/supabaseClient.ts` - Session persistence config
- `components/SessionManager.tsx` - Auto-refresh logic (mới)

---

## 🧪 Bước 3: Test Session 8 giờ

### 1. Đăng nhập vào app

```bash
npm run dev
# Hoặc truy cập production
```

### 2. Kiểm tra session trong Console

Mở DevTools (F12) → Console:

```javascript
// Check session expiry
const { data } = await supabase.auth.getSession()
console.log('Session expires at:', new Date(data.session.expires_at * 1000))
console.log('Time until expiry:', Math.round((data.session.expires_at - Date.now()/1000) / 3600), 'hours')
```

**Kết quả mong đợi:**
```
Session expires at: [8 giờ sau]
Time until expiry: ~8 hours
```

### 3. Test auto-refresh

Session sẽ tự động refresh khi:
- User mở app sau 7h55m (trước khi expire 5 phút)
- User thực hiện action (navigate, API call, etc.)

### 4. Verify persistence

1. Đăng nhập
2. Đóng browser
3. Mở lại browser trong vòng 8h
4. Refresh page → Vẫn đăng nhập ✅

---

## 📊 Timeline Session Lifecycle

```
Đăng nhập
    ↓
[0h] ──────────────────────── [7h55m] ──── [8h]
│                                 │         │
│                                 │         └─ JWT Expires
│                                 └─────────── Auto-refresh trigger
│
└─ Session created
```

**Với cấu hình 8 giờ:**
- Giờ 0: Đăng nhập, JWT valid đến giờ 8
- Giờ 7h55m: Auto-refresh được trigger
- Giờ 8: JWT mới valid đến giờ 16
- Cứ thế tiếp tục...

---

## 🔒 Security Considerations

### 1. Refresh Token Lifetime
Giữ refresh token lifetime = 30 ngày (mặc định)

**Lý do:**
- Access token (8h) ngắn → An toàn hơn nếu bị leak
- Refresh token (30 ngày) dài → UX tốt, không cần login lại thường xuyên

### 2. Inactivity Timeout
Nếu muốn logout user sau 8h không hoạt động:

```typescript
// Thêm vào SessionManager
const INACTIVITY_TIMEOUT = 8 * 60 * 60 * 1000 // 8 hours

let lastActivity = Date.now()

window.addEventListener('click', () => {
  lastActivity = Date.now()
})

setInterval(() => {
  if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
    supabase.auth.signOut()
  }
}, 60000) // Check every minute
```

### 3. Multiple Devices
User có thể đăng nhập trên max 3 devices (đã cấu hình).
Session 8h áp dụng cho tất cả devices.

---

## 🐛 Troubleshooting

### Session vẫn expire sau 1 giờ

**Nguyên nhân:** Supabase JWT Expiry chưa được cập nhật

**Fix:**
1. Kiểm tra lại Settings → Authentication → JWT Expiry
2. Đảm bảo giá trị là `28800` (không phải `3600`)
3. Save và đợi 1-2 phút
4. Đăng xuất và đăng nhập lại để lấy JWT mới

### Auto-refresh không hoạt động

**Nguyên nhân:** Browser tab bị background quá lâu

**Fix:**
- Browser có thể throttle background tabs
- SessionManager sẽ refresh khi user quay lại tab
- Code đã xử lý trường hợp này

### Session mất sau khi đóng browser

**Nguyên nhân:** Cookie không được persist

**Fix:**
1. Kiểm tra browser settings cho phép cookies
2. Đảm bảo không ở Incognito mode
3. Check DevTools → Application → Cookies → `cpls-auth-token`

---

## 📝 Summary

**Đã cấu hình:**
- ✅ JWT expiry: 8 giờ (28800s)
- ✅ Auto-refresh: 5 phút trước khi expire
- ✅ Persist session: Cookie + localStorage
- ✅ Cookie expiry: Match JWT expiry
- ✅ Session manager: Tự động refresh khi cần

**User experience:**
- Login 1 lần → Dùng 8 giờ liên tục
- Đóng browser → Mở lại vẫn login (trong 8h)
- Không active 30 ngày → Phải login lại
- Max 3 devices cùng lúc

**Next steps:**
1. Cấu hình JWT Expiry trong Supabase Dashboard
2. Test session với console commands
3. Verify persistence sau khi đóng browser

---

**Updated:** 2025-12-03
**For:** CPLS Project
