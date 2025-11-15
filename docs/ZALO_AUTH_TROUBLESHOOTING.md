# 🔧 Zalo OAuth Error -14003 - Troubleshooting Guide

Hướng dẫn khắc phục lỗi -14003 khi đăng nhập Zalo OAuth v4.

## ✅ UPDATE: PKCE ĐÃ ĐƯỢC IMPLEMENT (2025-11-15)

**PKCE đã được implement đầy đủ!** Xem chi tiết tại: [ZALO_PKCE_IMPLEMENTATION.md](./ZALO_PKCE_IMPLEMENTATION.md)

Các file đã được cập nhật:
- ✅ `components/ZaloLoginButton.tsx` - Generate và gửi code_challenge
- ✅ `app/auth/callback/page.tsx` - Gửi code_verifier trong token request
- ✅ `app/api/auth/zalo/token/route.ts` - Nhận và sử dụng code_verifier

**Nếu vẫn gặp lỗi sau khi update, vui lòng kiểm tra các mục bên dưới.**

---

## ❌ Lỗi Hiện Tại

**Error Code**: -14003
**Meaning**: Invalid parameter hoặc authentication failed
**Where**: Xảy ra khi exchange authorization code for access token

---

## 🔍 Nguyên Nhân Có Thể

### 1. Thiếu Tham Số Bắt Buộc

Zalo OAuth v4 có thể yêu cầu:
- ✅ `code` - Authorization code (có)
- ✅ `app_id` - Application ID (có)
- ✅ `grant_type` - "authorization_code" (có)
- ❓ `code_verifier` - PKCE verifier (MISSING)
- ❓ `redirect_uri` - Callback URL (có thể cần)

### 2. Sai Format Secret Key

Có 2 cách truyền secret:

**Cách 1: Header** (đang dùng)
```typescript
headers: {
  'Content-Type': 'application/x-www-form-urlencoded',
  'secret_key': appSecret,
}
```

**Cách 2: Body Parameter** (alternative)
```typescript
body: new URLSearchParams({
  code: code,
  app_id: appId,
  app_secret: appSecret,
  grant_type: 'authorization_code',
})
```

### 3. App Credentials Không Đúng

- App ID sai
- App Secret sai
- App chưa được active trong Zalo Developer Dashboard
- App không có quyền Social API

### 4. Authorization Code Issues

- Code đã được sử dụng (codes are single-use)
- Code đã expire (thường 5-10 phút)
- Code không match với app_id

---

## ✅ Giải Pháp Đã Thực Hiện

### Bước 1: Cải Thiện Error Logging

File: `app/api/auth/zalo/token/route.ts`

**Thay đổi**:
- ✅ Log đầy đủ response từ Zalo
- ✅ Parse cả `error_code` và `error_message`
- ✅ Return chi tiết error để debug
- ✅ Handle cả trường hợp Zalo return 200 với error field

**Cách kiểm tra**:
1. Mở Developer Console (F12)
2. Thử đăng nhập Zalo
3. Xem Network tab → `api/auth/zalo/token`
4. Xem Response để biết error chính xác từ Zalo

---

## 🛠️ Các Giải Pháp Khác Nếu Vẫn Lỗi

### Giải Pháp 2: Thử Format Secret Khác

Nếu vẫn lỗi -14003, thử thay đổi cách truyền secret:

```typescript
// Thay vì secret_key trong header, thử app_secret trong body
const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    code: code,
    app_id: appId,
    app_secret: appSecret,  // Thêm vào body thay vì header
    grant_type: 'authorization_code',
  }),
})
```

### Giải Pháp 3: Implement PKCE Flow

Zalo v4 có thể yêu cầu PKCE (Proof Key for Code Exchange).

**3.1. Tạo Code Verifier & Challenge**

File mới: `lib/pkce.ts`
```typescript
import crypto from 'crypto'

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
}
```

**3.2. Update Authorization URL**

File: `components/ZaloLoginButton.tsx`
```typescript
const handleZaloLogin = async () => {
  // Generate PKCE values
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Store verifier for later use
  sessionStorage.setItem('zalo_code_verifier', codeVerifier)

  const authUrl = new URL('https://oauth.zaloapp.com/v4/permission')
  authUrl.searchParams.set('app_id', appId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)  // NEW
  authUrl.searchParams.set('code_challenge_method', 'S256')  // NEW

  window.location.href = authUrl.toString()
}
```

**3.3. Send Code Verifier in Token Exchange**

File: `app/auth/callback/page.tsx`
```typescript
// Get stored code verifier
const codeVerifier = sessionStorage.getItem('zalo_code_verifier')

const tokenResponse = await fetch('/api/auth/zalo/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code,
    code_verifier: codeVerifier,  // NEW
  }),
})

// Clean up
sessionStorage.removeItem('zalo_code_verifier')
```

**3.4. Update Token API to Accept Code Verifier**

File: `app/api/auth/zalo/token/route.ts`
```typescript
const { code, code_verifier } = await request.json()

const params: Record<string, string> = {
  code: code,
  app_id: appId,
  grant_type: 'authorization_code',
}

// Add code_verifier if provided (PKCE)
if (code_verifier) {
  params.code_verifier = code_verifier
}

const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'secret_key': appSecret,
  },
  body: new URLSearchParams(params),
})
```

### Giải Pháp 4: Add Redirect URI Parameter

Một số OAuth providers yêu cầu `redirect_uri` trong token exchange:

```typescript
body: new URLSearchParams({
  code: code,
  app_id: appId,
  grant_type: 'authorization_code',
  redirect_uri: redirectUri,  // NEW - phải giống authorization request
})
```

---

## 🧪 Cách Test & Debug

### 1. Check App Credentials

Vào [Zalo Developer Dashboard](https://developers.zalo.me/):
- ✅ App đang ở trạng thái "Active"
- ✅ Copy đúng App ID và App Secret
- ✅ App có enable Social API
- ✅ Redirect URI đã được đăng ký chính xác

### 2. Test Authorization Flow

```bash
# Check authorization URL
console.log('Auth URL:', authUrl.toString())

# Should look like:
# https://oauth.zaloapp.com/v4/permission?app_id=XXX&redirect_uri=http://localhost:3000/auth/callback&state=XXX
```

### 3. Check Authorization Code

```bash
# In callback page
console.log('Received code:', code)
console.log('Code length:', code?.length)

# Valid code should be ~100 characters
```

### 4. Test Token Exchange Manually

```bash
curl -X POST https://oauth.zaloapp.com/v4/access_token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "secret_key: YOUR_APP_SECRET" \
  -d "code=YOUR_CODE&app_id=YOUR_APP_ID&grant_type=authorization_code"
```

### 5. Check Error Response

Sau khi update code với logging cải thiện:

```typescript
// In browser console, check:
const response = await fetch('/api/auth/zalo/token', {...})
const data = await response.json()
console.log('Full error:', data)

// Xem:
// - error_code: mã lỗi chính xác
// - error_message: thông báo lỗi
// - details: chi tiết từ Zalo
```

---

## 📝 Checklist Troubleshooting

- [ ] ✅ Check App ID và App Secret đúng
- [ ] ✅ App đang active trong Zalo Dashboard
- [ ] ✅ Redirect URI match chính xác (including http/https, port)
- [ ] ✅ Authorization code chưa được sử dụng trước đó
- [ ] ✅ Code chưa expire (test ngay sau khi nhận code)
- [ ] ✅ Check full error response từ Zalo (với logging mới)
- [ ] 🔄 Thử format secret khác (header vs body)
- [ ] 🔄 Implement PKCE nếu cần
- [ ] 🔄 Add redirect_uri parameter vào token request

---

## 📚 Tài Liệu Tham Khảo

- [Zalo OAuth v4 Documentation](https://developers.zalo.me/docs/social-api/tham-khao/user-access-token-v4)
- [OAuth 2.0 PKCE Spec](https://tools.ietf.org/html/rfc7636)
- [Zalo Developer Community](https://developers.zalo.me/community)

---

## 🔄 Next Steps

1. **Kiểm tra log mới**: Chạy lại auth flow và xem error chính xác
2. **Nếu vẫn -14003**: Thử Giải Pháp 2 (secret in body)
3. **Nếu vẫn lỗi**: Implement PKCE (Giải Pháp 3)
4. **Nếu vẫn ko được**: Contact Zalo Developer Support

---

**Updated**: 2025-11-14
**Branch**: `claude/check-zalo-auth-nick-01CyzQ5SFjWRTLYf94pj2JW7`
