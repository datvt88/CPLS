# CPLS - Hướng dẫn Deploy với Zalo OAuth

## 🎯 Tổng quan

Tài liệu này hướng dẫn nhanh cách deploy ứng dụng CPLS lên Vercel với Zalo OAuth authentication đã được bảo mật hoàn chỉnh.

## 🔐 Kiến trúc bảo mật

```
┌──────────────────┐
│   User Browser   │ NEXT_PUBLIC_ZALO_APP_ID (public ✅)
└────────┬─────────┘
         │ Click "Đăng nhập Zalo"
         ▼
┌──────────────────┐
│  Redirect Zalo   │ OAuth Authorization
└────────┬─────────┘
         │ Authorize
         ▼
┌────────────────────────────┐
│ /auth/callback?code=xxx    │
│ - Verify CSRF state        │
│ - Call API routes ↓        │
└────────────────────────────┘
         │
         ▼
┌───────────────────────────────────┐
│  API Routes (Server-side) 🔒      │
│  /api/auth/zalo/token              │
│  - Uses ZALO_APP_SECRET (secret)  │
│  - Exchange code → access_token   │
│                                    │
│  /api/auth/zalo/user               │
│  - Get user info from Zalo         │
└────────────┬──────────────────────┘
             │
             ▼
┌─────────────────────────┐
│  Supabase Database      │
│  - Create user          │
│  - Save profile         │
└─────────────────────────┘
```

**Lợi ích:**
- ✅ `ZALO_APP_SECRET` không bao giờ bị expose ra client
- ✅ Token exchange diễn ra ở server-side (Vercel Edge Functions)
- ✅ CSRF protection với state parameter
- ✅ Tuân thủ OAuth 2.0 security best practices

---

## 📋 Checklist trước khi deploy

### 1. Thông tin cần có

- [ ] **Zalo App ID** (từ https://developers.zalo.me/)
- [ ] **Zalo App Secret** (từ Zalo Developers - GIỮ BÍ MẬT!)
- [ ] **Supabase Project URL** (từ Supabase Dashboard)
- [ ] **Supabase Anon Key** (từ Supabase Dashboard > Settings > API)
- [ ] **Gemini API Key** (từ Google AI Studio - optional)

### 2. Database Setup

```bash
# 1. Vào Supabase Dashboard > SQL Editor
# 2. Copy nội dung từ: migrations/001_add_user_fields_and_zalo.sql
# 3. Run migration
# 4. Verify bảng profiles có các trường: full_name, phone_number, zalo_id, membership
```

---

## 🚀 Deploy lên Vercel

### Option 1: Via GitHub (Khuyến nghị)

#### Bước 1: Push code lên GitHub

```bash
git push origin main
```

#### Bước 2: Import vào Vercel

1. Vào https://vercel.com/new
2. Chọn repository `datvt88/CPLS`
3. Framework: **Next.js** (auto-detected)
4. Click **"Deploy"** (chưa cần config gì)

#### Bước 3: Thêm Environment Variables

Vào **Project Settings** > **Environment Variables**, thêm:

```
# PUBLIC VARIABLES (có thể thấy ở client)
NEXT_PUBLIC_ZALO_APP_ID=your_zalo_app_id_here
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# SECRET VARIABLES (chỉ ở server)
ZALO_APP_SECRET=your_zalo_app_secret_here
GEMINI_API_KEY=your_gemini_api_key_here
```

**⚠️ QUAN TRỌNG:**
- `ZALO_APP_SECRET` KHÔNG được có prefix `NEXT_PUBLIC_`
- Apply cho: **Production, Preview, Development**

#### Bước 4: Redeploy

Sau khi thêm env vars, click **"Redeploy"** trong Deployments tab.

### Option 2: Via Vercel CLI

```bash
# Install CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Add environment variables
vercel env add NEXT_PUBLIC_ZALO_APP_ID
vercel env add ZALO_APP_SECRET
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add GEMINI_API_KEY

# Redeploy with new env vars
vercel --prod --force
```

---

## 🔧 Cấu hình Zalo Developer

### Bước 1: Lấy Production URL

Sau khi deploy, Vercel cung cấp URL:
- Production: `https://your-app.vercel.app`
- Custom domain: `https://cpls.yourdomain.com`

### Bước 2: Update Redirect URIs

1. Vào https://developers.zalo.me/
2. Chọn app của bạn
3. **Settings** > **OAuth Settings**
4. Thêm các Redirect URIs:

```
https://your-app.vercel.app/auth/callback
https://cpls.yourdomain.com/auth/callback (nếu có custom domain)
http://localhost:3000/auth/callback (cho development)
```

5. **Lưu** thay đổi

### Bước 3: Kiểm tra permissions

Đảm bảo các scopes sau được bật:
- ✅ `id` - User ID
- ✅ `name` - User name
- ✅ `picture` - Avatar
- ⚠️ `phone` - Số điện thoại (cần phê duyệt)

---

## ✅ Kiểm tra sau deploy

### 1. Test OAuth Flow

```bash
# 1. Truy cập: https://your-app.vercel.app
# 2. Click "Đăng nhập với Zalo"
# 3. Authorize trên Zalo.me
# 4. Verify redirect về /auth/callback
# 5. Kiểm tra profile tại /profile
```

### 2. Verify Environment Variables

```bash
vercel env ls

# Should show:
# NEXT_PUBLIC_ZALO_APP_ID        Production, Preview
# ZALO_APP_SECRET (sensitive)    Production, Preview
# ...
```

### 3. Check Security

```bash
# ❌ Secret KHÔNG được xuất hiện trong client bundle
curl https://your-app.vercel.app/_next/static/chunks/app/page.js | grep "YOUR_ACTUAL_SECRET"
# Result: NO MATCHES = ✅ Good!

# ✅ HTTPS enforced
curl -I http://your-app.vercel.app/
# Should redirect to https://
```

### 4. Check Logs

```bash
# Via CLI
vercel logs

# Via Dashboard
# https://vercel.com/[team]/[project]/logs
```

---

## 📚 Documentation

Tài liệu chi tiết:

| Document | Description |
|----------|-------------|
| [ZALO_AUTH_SETUP.md](docs/ZALO_AUTH_SETUP.md) | Hướng dẫn setup Zalo Developer Console |
| [ZALO_AUTH_IMPLEMENTATION.md](docs/ZALO_AUTH_IMPLEMENTATION.md) | Chi tiết kỹ thuật implementation |
| [VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) | Hướng dẫn deploy chi tiết |
| [SECURITY.md](docs/SECURITY.md) | Security best practices |

---

## 🔒 Security Checklist

Trước khi go live:

- [ ] `ZALO_APP_SECRET` không có prefix `NEXT_PUBLIC_`
- [ ] Secrets không được commit vào Git
- [ ] `.env.local` trong `.gitignore`
- [ ] RLS enabled trong Supabase
- [ ] Redirect URIs chỉ có domains tin cậy
- [ ] HTTPS enforced
- [ ] State parameter được verify
- [ ] Error messages không leak sensitive info

---

## 🆘 Troubleshooting

### "Zalo OAuth not properly configured"

**Fix:**
```bash
vercel env add ZALO_APP_SECRET
# Enter your secret
vercel --prod --force
```

### "Invalid redirect URI"

**Fix:**
1. Vào Zalo Developers > OAuth Settings
2. Thêm: `https://your-actual-domain.vercel.app/auth/callback`
3. Đảm bảo URL khớp chính xác (không trailing slash)

### Build fails on Vercel

**Fix:**
```bash
# Test locally
npm run build

# Check Node version (should be 18+)
# In package.json, add:
"engines": {
  "node": ">=18.0.0"
}
```

### Environment variables không update

**Fix:**
```bash
vercel --force  # Force redeploy
```

---

## 📊 Architecture Overview

### Files Structure

```
app/
├── api/
│   └── auth/
│       └── zalo/
│           ├── authorize/route.ts  # Generate OAuth URL
│           ├── token/route.ts      # Exchange code → token (SERVER-SIDE)
│           └── user/route.ts       # Fetch user info (SERVER-SIDE)
├── auth/
│   └── callback/
│       └── page.tsx                # OAuth callback handler
├── profile/
│   └── page.tsx                    # User profile management
└── ...

components/
├── ZaloLoginButton.tsx             # Zalo login button
├── AuthForm.tsx                    # Auth form with Zalo option
└── ProtectedRoute.tsx              # Route protection

services/
├── auth.service.ts                 # Authentication service
└── profile.service.ts              # Profile management

migrations/
└── 001_add_user_fields_and_zalo.sql # Database migration

docs/
├── ZALO_AUTH_SETUP.md              # Setup guide
├── ZALO_AUTH_IMPLEMENTATION.md     # Technical docs
├── VERCEL_DEPLOYMENT.md            # Deployment guide
└── SECURITY.md                     # Security best practices
```

### API Routes Security

| Route | Method | Sensitive Data | Security |
|-------|--------|----------------|----------|
| `/api/auth/zalo/authorize` | GET | ❌ None | Public |
| `/api/auth/zalo/token` | POST | ✅ `ZALO_APP_SECRET` | Server-only |
| `/api/auth/zalo/user` | POST | ✅ Access token | Server-only |

---

## 🎓 Key Concepts

### Why server-side token exchange?

**❌ Client-side (insecure):**
```javascript
// BAD: Secret exposed to browser
const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
  headers: { 'secret_key': ZALO_APP_SECRET } // ⚠️ Visible in DevTools!
})
```

**✅ Server-side (secure):**
```javascript
// GOOD: Secret stays on server
const response = await fetch('/api/auth/zalo/token', {
  method: 'POST',
  body: JSON.stringify({ code })
})
// Server handles secret internally
```

### Environment Variables Types

**NEXT_PUBLIC_* (Public)**
- Embedded into client JavaScript bundle
- Visible in browser DevTools
- Safe for: App IDs, public URLs, feature flags

**No prefix (Secret)**
- Only available in server-side code (API routes, getServerSideProps)
- Never sent to browser
- Required for: API secrets, private keys, database passwords

---

## 📞 Support

Issues? Check:
1. Vercel deployment logs
2. Browser console (F12)
3. Supabase logs
4. Zalo Developer Console logs

Tài liệu:
- [Zalo OAuth Docs](https://developers.zalo.me/docs/api/social-api/tai-lieu)
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)

---

## 🎉 Summary

Sau khi hoàn thành các bước trên, bạn sẽ có:

✅ Ứng dụng CPLS deployed trên Vercel
✅ Zalo OAuth hoạt động an toàn với server-side token exchange
✅ Environment variables được cấu hình đúng
✅ Database migrations đã chạy
✅ User profiles với membership system
✅ Security best practices được áp dụng

**Happy Deploying! 🚀**
