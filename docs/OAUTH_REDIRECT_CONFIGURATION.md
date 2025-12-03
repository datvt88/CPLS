# Cấu Hình OAuth Redirect URLs cho Supabase

## 🎯 Vấn Đề

Khi đăng nhập bằng Google OAuth, Supabase redirect về homepage `/` với code parameter thay vì callback page `/auth/callback`:

```
❌ Lỗi: http://localhost:3000/?code=xxx
✅ Đúng: http://localhost:3000/auth/callback?code=xxx
```

## 🔍 Nguyên Nhân

1. **Site URL không đúng** trong Supabase project settings
2. **Redirect URLs chưa được cấu hình** đầy đủ
3. **Homepage không xử lý** OAuth callback parameters

## ✅ Giải Pháp Đã Implement

### 1. Thêm Logic Redirect ở Homepage

File: `app/page.tsx`

```typescript
useEffect(() => {
  // Detect OAuth callback parameters
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));

  const code = urlParams.get('code');
  const accessToken = hashParams.get('access_token');
  const error = urlParams.get('error') || hashParams.get('error');

  // If OAuth parameters present, redirect to callback page
  if (code || accessToken || error) {
    router.replace(`/auth/callback${window.location.search}${window.location.hash}`);
    return;
  }
}, [router]);
```

**Cách hoạt động:**
- Khi user redirect về homepage với `?code=xxx`
- Logic detect OAuth parameters
- Tự động redirect sang `/auth/callback?code=xxx`
- Callback page xử lý code và tạo session

### 2. Cấu Hình Supabase Project Settings

#### Bước 1: Vào Supabase Dashboard

1. Mở [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **Authentication** → **URL Configuration**

#### Bước 2: Cấu Hình Site URL

**Development:**
```
Site URL: http://localhost:3000
```

**Production:**
```
Site URL: https://your-domain.vercel.app
```

#### Bước 3: Cấu Hình Redirect URLs

Thêm các URLs sau vào **Redirect URLs** (cách nhau bởi dấu phẩy):

**Development:**
```
http://localhost:3000/auth/callback,
http://localhost:3000,
http://127.0.0.1:3000/auth/callback,
http://127.0.0.1:3000
```

**Production:**
```
https://your-domain.vercel.app/auth/callback,
https://your-domain.vercel.app,
https://cpls.vercel.app/auth/callback,
https://cpls.vercel.app
```

**⚠️ Lưu ý:**
- Phải có cả `/auth/callback` VÀ root URL `/`
- Không có trailing slash
- Phân biệt http/https
- localhost và 127.0.0.1 là khác nhau

#### Bước 4: Lưu Thay Đổi

Nhấn **Save** để áp dụng cấu hình.

### 3. Cấu Hình Google OAuth Provider

#### Vào Google Cloud Console

1. Mở [Google Cloud Console](https://console.cloud.google.com)
2. Chọn project của bạn
3. Vào **APIs & Services** → **Credentials**
4. Chọn OAuth 2.0 Client ID

#### Cấu Hình Authorized Redirect URIs

Thêm các URIs sau:

**Development:**
```
http://localhost:3000/auth/callback
http://127.0.0.1:3000/auth/callback
```

**Production:**
```
https://your-domain.vercel.app/auth/callback
https://cpls.vercel.app/auth/callback
```

**⚠️ Lưu ý:**
- Google OAuth chỉ chấp nhận HTTPS trên production
- Localhost được phép dùng HTTP
- Path phải là `/auth/callback`

## 🧪 Test OAuth Flow

### Test Local

```bash
# 1. Start dev server
npm run dev

# 2. Mở browser và login bằng Google
http://localhost:3000/login

# 3. Sau khi Google redirect, kiểm tra URL:
# ✅ Đúng: http://localhost:3000/auth/callback?code=xxx
# hoặc
# ✅ Đúng: http://localhost:3000/?code=xxx (tự động redirect sang callback)

# 4. Kiểm tra console logs:
# 🔄 [Homepage] OAuth parameters detected, redirecting to callback page...
# 🔐 [PKCE] Processing Supabase PKCE OAuth...
# ✅ [PKCE] Session established
# 🚀 [PKCE] Redirecting to dashboard...
```

### Test Production

```bash
# Deploy lên Vercel
vercel --prod

# Test OAuth flow
https://your-domain.vercel.app/login
```

## 🔄 OAuth Flow Diagram

```
User clicks "Login with Google"
         ↓
Google OAuth Authorization
         ↓
[OPTION 1] Redirect to /auth/callback?code=xxx
         ↓
handleSupabasePKCE() exchanges code for session
         ↓
Redirect to /dashboard

[OPTION 2] Redirect to /?code=xxx (nếu Site URL = /)
         ↓
Homepage detects code parameter
         ↓
Auto redirect to /auth/callback?code=xxx
         ↓
handleSupabasePKCE() exchanges code for session
         ↓
Redirect to /dashboard
```

## 📝 Checklist

### Supabase Configuration
- [ ] Site URL set đúng
- [ ] Redirect URLs bao gồm `/auth/callback`
- [ ] Redirect URLs bao gồm root `/`
- [ ] Both localhost và 127.0.0.1 (nếu cần)
- [ ] Both http và https (production)

### Google OAuth Configuration
- [ ] Authorized Redirect URIs có `/auth/callback`
- [ ] Localhost URIs cho development
- [ ] Production domain URIs
- [ ] HTTPS cho production

### Code Implementation
- [ ] Homepage có OAuth redirect logic
- [ ] Callback page có handleSupabasePKCE()
- [ ] Auth service redirectTo = `/auth/callback`
- [ ] Error handling cho OAuth failures

## 🐛 Troubleshooting

### Vấn đề: Redirect về homepage với code

**Nguyên nhân:** Site URL trong Supabase = `/` (root)

**Giải pháp:**
1. Homepage sẽ tự động detect và redirect sang `/auth/callback`
2. Hoặc update Site URL trong Supabase thành `/auth/callback`

### Vấn đề: "Invalid redirect URI" error

**Nguyên nhân:** URL không nằm trong danh sách allowed redirects

**Giải pháp:**
1. Kiểm tra Supabase Redirect URLs
2. Kiểm tra Google OAuth Authorized Redirect URIs
3. Đảm bảo URL khớp chính xác (no trailing slash)

### Vấn đề: Code exchange failed

**Nguyên nhân:** PKCE code expired hoặc invalid

**Giải pháp:**
1. Kiểm tra `supabase.auth.exchangeCodeForSession(code)`
2. Kiểm tra Supabase logs
3. Đảm bảo flowType = 'pkce' trong supabaseClient.ts

## 📚 Tài Liệu Liên Quan

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [PKCE Flow](https://oauth.net/2/pkce/)

## ✅ Kết Quả

Sau khi cấu hình đúng:

- ✅ Google OAuth login hoạt động
- ✅ PKCE code được exchange thành session
- ✅ User được redirect vào dashboard
- ✅ Session được lưu trong cookie (30 ngày)
- ✅ Auto-refresh token (mỗi 50 phút)

## 🚀 Next Steps

1. Test OAuth flow trên local
2. Deploy lên Vercel production
3. Test OAuth flow trên production
4. Verify session persistence
5. Check device tracking hoạt động

---

**Last Updated:** 2025-12-03
**Author:** Claude Code AI
**Related Issues:** OAuth callback redirect error
