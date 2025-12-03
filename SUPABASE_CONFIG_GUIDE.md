# 🔐 Hướng Dẫn Cấu Hình Session 30 Ngày cho Supabase

## 📋 Tổng Quan

Để người dùng không phải đăng nhập lại mỗi lần truy cập và lưu session 30 ngày, cần cấu hình cả **client-side** và **server-side (Supabase)**.

---

## ✅ Cấu Hình Client-Side (Đã Hoàn Thành)

### 1. Cookie Storage - 30 Days ✅
**File:** `lib/supabaseClient.ts`

```typescript
// Set to cookie with 30 days expiry (line 76)
this.setCookie(key, value, 30)
```

### 2. Session Manager - 30 Days ✅
**File:** `lib/session-manager.ts`

```typescript
// Session expires after 30 days (line 226)
expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
```

### 3. Persistent Session Manager - 30 Days ✅
**File:** `components/PersistentSessionManager.tsx`

```typescript
// Inactivity timeout: 30 days (line 7)
const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000
```

### 4. Auto Refresh Token ✅
**File:** `lib/supabaseClient.ts`

```typescript
auth: {
  autoRefreshToken: true, // Auto refresh trước khi hết hạn
  persistSession: true,   // Lưu session persistent
}
```

---

## 🔧 Cấu Hình Server-Side (Supabase Dashboard)

### Bước 1: Truy Cập Supabase Dashboard

1. Đăng nhập vào [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn (CPLS)
3. Vào menu **Authentication** → **Settings**

### Bước 2: Cấu Hình JWT Settings

Tìm section **JWT Settings** và cấu hình:

#### 2.1. JWT Expiry (Access Token)
```
Default: 3600 seconds (1 hour)
Khuyến nghị: 28800 seconds (8 hours)
```

**Lý do:**
- Access token 8 giờ giúp giảm tần suất refresh
- Vẫn đủ bảo mật (không quá dài)
- Phù hợp với thói quen sử dụng hàng ngày

#### 2.2. Refresh Token Rotation
```
✅ Enable Refresh Token Rotation
```

**Lý do:**
- Tăng bảo mật bằng cách rotate refresh token sau mỗi lần dùng
- Ngăn chặn refresh token bị đánh cắp sử dụng lại

#### 2.3. Refresh Token Reuse Interval
```
Default: 10 seconds
Khuyến nghị: 10 seconds (giữ nguyên)
```

### Bước 3: Cấu Hình Session Settings

Tìm section **Security and Sessions**:

#### 3.1. Session Timeout
```
Default: 604800 seconds (7 days)
Khuyến nghị: 2592000 seconds (30 days)
```

**Lý do:** Session timeout 30 ngày cho phép user không phải login lại

#### 3.2. Disable Session Timeout
```
❌ KHÔNG enable (để trống)
```

**Lý do:** Cần có timeout để security, 30 ngày là hợp lý

### Bước 4: Cấu Hình Auth Settings

#### 4.1. Enable Auto-Refresh Token
```
✅ Enable Auto-Refresh Token (default)
```

#### 4.2. Minimum Password Strength
```
Weak | Fair | Good | Strong
Chọn: Good hoặc Strong
```

### Bước 5: Save Changes

Click **Save** để lưu tất cả thay đổi.

---

## 🔍 Cách Kiểm Tra Cấu Hình

### 1. Kiểm Tra JWT Expiry

Sử dụng browser console:

```javascript
// Lấy session hiện tại
const { data: { session } } = await supabase.auth.getSession()

// Kiểm tra expires_at
const expiresAt = new Date(session.expires_at * 1000)
console.log('Token expires at:', expiresAt)

// Tính thời gian còn lại
const now = new Date()
const hoursRemaining = (expiresAt - now) / (1000 * 60 * 60)
console.log('Hours remaining:', hoursRemaining)
```

**Kết quả mong đợi:** ~8 hours (nếu mới login)

### 2. Kiểm Tra Refresh Token

```javascript
// Thử refresh token
const { data, error } = await supabase.auth.refreshSession()

if (error) {
  console.error('Refresh failed:', error)
} else {
  console.log('Refresh successful:', data.session)
}
```

**Kết quả mong đợi:** Refresh thành công, có session mới

### 3. Kiểm Tra Session Info Component

Thêm component vào layout:

```tsx
// app/layout.tsx
import SessionInfo from '@/components/SessionInfo'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SessionInfo />
      </body>
    </html>
  )
}
```

Click vào icon ở góc phải dưới để xem thông tin session.

---

## 📊 Cấu Hình Tối Ưu

### Recommended Settings

| Setting | Value | Lý do |
|---------|-------|-------|
| **JWT Expiry** | 28800s (8h) | Balance giữa UX và security |
| **Session Timeout** | 2592000s (30 days) | User không phải login lại 30 ngày |
| **Refresh Token Rotation** | Enabled | Tăng security |
| **Auto-Refresh Token** | Enabled | UX mượt mà |
| **Cookie Expiry** | 30 days | Persist session |
| **Inactivity Timeout** | 30 days | Auto logout sau 30 ngày không dùng |
| **Max Devices** | 3 | Giới hạn devices cho security |

---

## 🔄 Flow Hoạt Động

### Login Flow
```
1. User đăng nhập
2. Supabase tạo access token (8h) + refresh token (30 days)
3. Client lưu vào cookie + localStorage
4. Tạo session record trong DB với expires_at = now + 30 days
5. Tạo device fingerprint và lưu vào DB
```

### Auto-Refresh Flow
```
1. PersistentSessionManager check token expiry mỗi 50 phút
2. Nếu sắp hết hạn (< 5 phút), auto refresh
3. Refresh token → new access token + new refresh token
4. Update session activity trong DB
5. User không bị interrupt
```

### Inactivity Logout Flow
```
1. Track user activity (click, keypress, scroll, mousemove)
2. Update last_activity mỗi 5 phút
3. Check inactivity mỗi 1 giờ
4. Nếu > 30 ngày không hoạt động → auto logout
5. Redirect to /login page
```

### Device Limit Flow
```
1. User login từ device mới (device #4)
2. Check device count = 3 (đạt limit)
3. Remove oldest device (based on last_active_at)
4. Add new device
5. User trên device cũ bị logout tại session tiếp theo
```

---

## 🧪 Testing Checklist

- [ ] Login và kiểm tra session được lưu
- [ ] Refresh page → vẫn logged in
- [ ] Đóng browser → mở lại → vẫn logged in (trong 30 ngày)
- [ ] Token auto-refresh trước khi hết hạn
- [ ] Session info component hiển thị đúng
- [ ] Login từ 4 devices → device cũ nhất bị remove
- [ ] Không hoạt động 30 ngày → auto logout
- [ ] Manual logout → clear tất cả cache

---

## 🚀 Production Checklist

### Pre-Deployment
- [ ] Set JWT Expiry = 28800s (8 hours)
- [ ] Set Session Timeout = 2592000s (30 days)
- [ ] Enable Refresh Token Rotation
- [ ] Enable Auto-Refresh Token
- [ ] Test login flow
- [ ] Test auto-refresh flow
- [ ] Test device limit

### Post-Deployment
- [ ] Monitor Supabase logs for auth errors
- [ ] Check refresh token usage
- [ ] Verify session persistence
- [ ] Test from multiple devices
- [ ] Check cookie expiry in browser

---

## 📝 Notes

1. **JWT Expiry vs Session Timeout:**
   - JWT Expiry: Thời gian sống của access token (8h)
   - Session Timeout: Thời gian tối đa session được lưu (30 days)
   - Refresh token cho phép get new access token without re-login

2. **Security Considerations:**
   - 30 days là balance tốt giữa UX và security
   - Device fingerprinting giúp track devices
   - Inactivity logout ngăn chặn session bỏ quên
   - Max 3 devices giới hạn exposure

3. **Cookie vs localStorage:**
   - Cookie: Secure hơn, support SSR, auto-sent với requests
   - localStorage: Fallback, dễ access từ JS
   - Dùng cả 2 để redundancy

4. **Refresh Token Rotation:**
   - Mỗi lần refresh → new refresh token
   - Old refresh token bị invalidate
   - Ngăn chặn token replay attacks

---

## 🔗 References

- [Supabase Auth Config](https://supabase.com/docs/guides/auth/auth-helpers/auth-ui)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

---

## 💡 Troubleshooting

### Issue: Token không auto-refresh

**Solution:**
1. Check Supabase dashboard: Auto-Refresh Token enabled
2. Check PersistentSessionManager is mounted
3. Check browser console for errors
4. Verify refresh token chưa expire

### Issue: User bị logout sau vài giờ

**Solution:**
1. Check JWT Expiry setting in Supabase
2. Check Session Timeout setting
3. Verify cookie expiry = 30 days
4. Check PersistentSessionManager auto-refresh

### Issue: Session không persist sau khi close browser

**Solution:**
1. Check cookie SameSite = Lax (not Strict)
2. Check cookie has expiry (not session cookie)
3. Verify localStorage also has token
4. Check browser không clear cookies on close

---

**Last Updated:** 2025-12-03
**Version:** 1.0
