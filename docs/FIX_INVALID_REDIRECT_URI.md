# ⚠️ Fix Lỗi "Invalid Redirect URI" - Zalo OAuth

## 🎯 Vấn Đề

**Lỗi:** `Invalid redirect URI` từ Zalo OAuth
**Nguyên nhân:** Redirect URI trong code không khớp CHÍNH XÁC với URI đã đăng ký trong Zalo Developer Console

---

## 🔍 Kiểm Tra Redirect URI Hiện Tại

### Bước 1: Xem Redirect URI đang sử dụng

**Trong code (ZaloLoginButton.tsx:33):**
```typescript
const redirectUri = `${window.location.origin}/auth/callback`
```

**Giá trị thực tế tùy thuộc môi trường:**

| Môi trường | Redirect URI |
|------------|--------------|
| **Development** | `http://localhost:3000/auth/callback` |
| **Production** | `https://yourdomain.com/auth/callback` |
| **Staging** | `https://staging.yourdomain.com/auth/callback` |
| **Vercel** | `https://yourapp.vercel.app/auth/callback` |

### Bước 2: Debug - Xem URI đang gửi đi

**Thêm console.log vào ZaloLoginButton.tsx:**

```typescript
const handleZaloLogin = async () => {
  try {
    setLoading(true)
    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID

    if (!appId) {
      throw new Error('Zalo App ID not configured')
    }

    const redirectUri = `${window.location.origin}/auth/callback`
    const state = generateState()

    // 🔍 DEBUG: Log redirect URI
    console.log('=== ZALO OAUTH DEBUG ===')
    console.log('Current origin:', window.location.origin)
    console.log('Redirect URI:', redirectUri)
    console.log('App ID:', appId)
    console.log('========================')

    // ... rest of code
```

**Mở Developer Console (F12) và xem log khi click "Đăng nhập với Zalo"**

---

## ✅ Fix: Đăng Ký Redirect URI trong Zalo Developer Console

### Bước 1: Đăng nhập Zalo Developer Console

1. Truy cập: https://developers.zalo.me/
2. Đăng nhập bằng tài khoản Zalo
3. Chọn app của bạn (hoặc tạo app mới nếu chưa có)

### Bước 2: Tìm phần Redirect URIs

1. Trong Zalo App Dashboard, tìm:
   - **"OAuth Settings"** HOẶC
   - **"Redirect URIs"** HOẶC
   - **"Callback URLs"** HOẶC
   - **"App Settings"** → Tab "OAuth"

2. Xem danh sách Redirect URIs hiện tại

### Bước 3: Thêm Redirect URIs

**⚠️ QUAN TRỌNG: Phải đăng ký CHÍNH XÁC từng URI bạn sẽ dùng!**

**Development (localhost):**
```
http://localhost:3000/auth/callback
```

**Production:**
```
https://yourdomain.com/auth/callback
```

**Vercel Preview/Production:**
```
https://yourapp.vercel.app/auth/callback
https://yourapp-git-main-yourteam.vercel.app/auth/callback
```

**Custom Domain:**
```
https://cpls.yourdomain.com/auth/callback
```

**Staging:**
```
https://staging.yourdomain.com/auth/callback
```

### Bước 4: Lưu và Chờ

1. Click **"Save"** hoặc **"Cập nhật"**
2. Đợi 1-2 phút để Zalo update cấu hình
3. Refresh lại app của bạn
4. Thử login lại

---

## 🚨 Các Lỗi Thường Gặp

### Lỗi 1: HTTP vs HTTPS

**Sai:**
```
Đã đăng ký: http://yourdomain.com/auth/callback
Đang dùng:    https://yourdomain.com/auth/callback  ❌
```

**Đúng:**
```
Cả hai phải giống nhau hoàn toàn  ✅
```

### Lỗi 2: Trailing Slash

**Sai:**
```
Đã đăng ký: https://yourdomain.com/auth/callback/
Đang dùng:    https://yourdomain.com/auth/callback   ❌
```

**Đúng:**
```
https://yourdomain.com/auth/callback (không có slash cuối)  ✅
```

### Lỗi 3: Port Number

**Sai:**
```
Đã đăng ký: http://localhost:3000/auth/callback
Đang dùng:    http://localhost:3001/auth/callback  ❌
```

**Đúng:**
```
Port phải giống nhau  ✅
```

### Lỗi 4: Subdomain

**Sai:**
```
Đã đăng ký: https://www.yourdomain.com/auth/callback
Đang dùng:    https://yourdomain.com/auth/callback  ❌
```

**Đúng:**
```
Với www:    https://www.yourdomain.com/auth/callback
Không www:  https://yourdomain.com/auth/callback
(phải đăng ký cả 2 nếu support cả 2)  ✅
```

### Lỗi 5: Case Sensitive

**Một số OAuth providers phân biệt chữ hoa/thường:**
```
Đã đăng ký: https://yourdomain.com/auth/Callback  ❌
Đang dùng:    https://yourdomain.com/auth/callback
```

**Luôn dùng lowercase:**
```
https://yourdomain.com/auth/callback  ✅
```

---

## 🔧 Giải Pháp Nhanh: Override Redirect URI

**Nếu bạn cần override redirect URI cho testing:**

### Bước 1: Thêm env variable

**File: `.env.local`**
```bash
# Override redirect URI (optional - for testing only)
NEXT_PUBLIC_REDIRECT_URI=https://your-exact-domain.com/auth/callback
```

### Bước 2: Update code

**File: `components/ZaloLoginButton.tsx`**

```typescript
const handleZaloLogin = async () => {
  try {
    setLoading(true)
    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID

    if (!appId) {
      throw new Error('Zalo App ID not configured')
    }

    // Use override if provided, otherwise auto-detect
    const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI ||
                        `${window.location.origin}/auth/callback`

    console.log('🔍 Redirect URI:', redirectUri)  // Debug log

    // ... rest of code
```

**⚠️ Chỉ dùng cho testing! Production nên để auto-detect.**

---

## 📋 Checklist Fix Lỗi

- [ ] **1. Identify Redirect URI đang dùng**
  - Open DevTools Console
  - Click "Đăng nhập với Zalo"
  - Copy redirect URI từ log

- [ ] **2. Đăng nhập Zalo Developer Console**
  - https://developers.zalo.me/
  - Chọn app của bạn

- [ ] **3. Kiểm tra Redirect URIs đã đăng ký**
  - Vào OAuth Settings
  - Xem danh sách URIs

- [ ] **4. So sánh**
  - URI trong log === URI đã đăng ký?
  - Chính xác 100% (http/https, port, path)?

- [ ] **5. Thêm thiếu URI**
  - Development: `http://localhost:3000/auth/callback`
  - Production: `https://yourdomain.com/auth/callback`
  - Save changes

- [ ] **6. Đợi và test**
  - Đợi 1-2 phút
  - Refresh app
  - Thử login lại

- [ ] **7. Verify**
  - Click login
  - Không có lỗi "invalid redirect uri"
  - Redirect về callback page thành công

---

## 🧪 Test Redirect URI

**Tạo file test (optional):**

**File: `app/test-zalo-config/page.tsx`** (NEW FILE)

```typescript
'use client'

import { useState } from 'react'

export default function TestZaloConfig() {
  const [result, setResult] = useState<any>(null)

  const testConfig = () => {
    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID
    const redirectUri = `${window.location.origin}/auth/callback`
    const overrideUri = process.env.NEXT_PUBLIC_REDIRECT_URI

    setResult({
      appId: appId || 'NOT SET',
      currentOrigin: window.location.origin,
      autoDetectedRedirectUri: redirectUri,
      overrideRedirectUri: overrideUri || 'NOT SET',
      finalRedirectUri: overrideUri || redirectUri,
      timestamp: new Date().toISOString(),
    })
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🔍 Test Zalo OAuth Config</h1>

      <button
        onClick={testConfig}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Test Configuration
      </button>

      {result && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="font-bold mb-2">Current Configuration:</h2>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>

          <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-500">
            <p className="font-bold">⚠️ Make sure this URI is registered in Zalo Console:</p>
            <code className="block mt-2 p-2 bg-white">
              {result.finalRedirectUri}
            </code>
          </div>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h3 className="font-bold mb-2">📝 Steps to Fix:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Click "Test Configuration" button above</li>
          <li>Copy the "finalRedirectUri" value</li>
          <li>Go to https://developers.zalo.me/</li>
          <li>Open your app → OAuth Settings</li>
          <li>Add the URI to Redirect URIs list</li>
          <li>Save and wait 1-2 minutes</li>
          <li>Try login again</li>
        </ol>
      </div>
    </div>
  )
}
```

**Truy cập:** `http://localhost:3000/test-zalo-config`

---

## 📚 Tài Liệu Tham Khảo

- [Zalo Developer Console](https://developers.zalo.me/)
- [OAuth 2.0 Redirect URI Best Practices](https://www.oauth.com/oauth2-servers/redirect-uris/)
- Xem thêm: `docs/VERCEL_DEPLOYMENT.md` - Section "Cấu hình Zalo OAuth Redirect URIs"

---

## ✅ Expected Result Sau Khi Fix

```
1. Click "Đăng nhập với Zalo"
   ↓
2. Redirect đến Zalo OAuth (không có lỗi)
   ↓
3. User xác thực trên Zalo
   ↓
4. Redirect về /auth/callback (thành công)
   ↓
5. Token exchange success
   ↓
6. Redirect vào dashboard ✅
```

---

**Created:** 2025-11-15
**Issue:** Invalid Redirect URI
**Priority:** 🔴 Critical - Blocking login
