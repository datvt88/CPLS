# Hướng dẫn Deploy lên Vercel - Cấu hình bảo mật

Tài liệu này hướng dẫn chi tiết cách deploy ứng dụng CPLS lên Vercel với cấu hình environment variables bảo mật.

## Mục lục

1. [Tổng quan bảo mật](#tổng-quan-bảo-mật)
2. [Chuẩn bị trước khi deploy](#chuẩn-bị-trước-khi-deploy)
3. [Cấu hình Environment Variables](#cấu-hình-environment-variables)
4. [Deploy lên Vercel](#deploy-lên-vercel)
5. [Cấu hình Zalo OAuth Redirect URIs](#cấu-hình-zalo-oauth-redirect-uris)
6. [Kiểm tra sau deploy](#kiểm-tra-sau-deploy)
7. [Troubleshooting](#troubleshooting)

---

## Tổng quan bảo mật

### Kiến trúc bảo mật

Ứng dụng CPLS sử dụng kiến trúc 3-tier để bảo vệ thông tin nhạy cảm:

```
┌─────────────────────────────────────────────────┐
│         CLIENT (Browser)                        │
│  - NEXT_PUBLIC_* variables (public)             │
│  - No sensitive secrets                         │
└──────────────────┬──────────────────────────────┘
                   │
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────┐
│    VERCEL EDGE/SERVERLESS (API Routes)          │
│  - ZALO_APP_SECRET (server-only)                │
│  - Token exchange with Zalo API                 │
│  - User info fetching                           │
└──────────────────┬──────────────────────────────┘
                   │
                   │ Secure Connection
                   ▼
┌─────────────────────────────────────────────────┐
│          SUPABASE (Database)                    │
│  - User profiles                                │
│  - Membership data                              │
└─────────────────────────────────────────────────┘
```

### Phân loại Environment Variables

| Variable | Type | Visible to | Usage |
|----------|------|------------|-------|
| `NEXT_PUBLIC_ZALO_APP_ID` | **Public** | Client + Server | Initialize OAuth flow |
| `ZALO_APP_SECRET` | **Secret** | Server only | Exchange authorization code |
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** | Client + Server | Connect to Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public** | Client + Server | Row-level security |
| `GEMINI_API_KEY` | **Secret** | Server only | AI signal generation |

### Nguyên tắc bảo mật

✅ **DO (Nên làm):**
- Sử dụng `NEXT_PUBLIC_*` prefix cho biến public (App ID, Supabase URL)
- Giữ `ZALO_APP_SECRET` chỉ ở server-side API routes
- Thực hiện token exchange ở server, không ở client
- Verify CSRF state parameter trong OAuth callback
- Sử dụng HTTPS trong production
- Enable RLS (Row Level Security) trong Supabase

❌ **DON'T (Không nên):**
- Đặt `NEXT_PUBLIC_` prefix cho App Secret
- Gọi Zalo token API trực tiếp từ client
- Hard-code credentials trong source code
- Commit `.env.local` vào Git
- Disable HTTPS trong production
- Expose raw access tokens trong client

---

## Chuẩn bị trước khi deploy

### 1. Kiểm tra code

```bash
# Build locally để kiểm tra lỗi
npm run build

# Chạy production build locally
npm start
```

### 2. Kiểm tra file .gitignore

Đảm bảo `.gitignore` có các dòng sau:

```
# Environment variables
.env
.env.local
.env*.local

# Vercel
.vercel
```

### 3. Chuẩn bị thông tin cần thiết

Bạn sẽ cần:
- ✅ Zalo App ID (từ https://developers.zalo.me/)
- ✅ Zalo App Secret (từ Zalo Developers)
- ✅ Supabase Project URL (từ Supabase Dashboard)
- ✅ Supabase Anon Key (từ Supabase Dashboard > Settings > API)
- ✅ Gemini API Key (từ Google AI Studio)

---

## Cấu hình Environment Variables

### Option 1: Qua Vercel Dashboard (Khuyến nghị)

#### Bước 1: Truy cập Project Settings

1. Đăng nhập vào https://vercel.com
2. Chọn project của bạn
3. Vào **Settings** > **Environment Variables**

#### Bước 2: Thêm từng biến

**Public Variables** (có thể thấy ở client):

```
Name: NEXT_PUBLIC_ZALO_APP_ID
Value: [Your Zalo App ID]
Environment: Production, Preview, Development
```

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project.supabase.co
Environment: Production, Preview, Development
```

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Your Supabase Anon Key]
Environment: Production, Preview, Development
```

**Secret Variables** (chỉ ở server):

```
Name: ZALO_APP_SECRET
Value: [Your Zalo App Secret]
Environment: Production, Preview, Development
⚠️ SENSITIVE - Keep this secret!
```

```
Name: GEMINI_API_KEY
Value: [Your Gemini API Key]
Environment: Production, Preview, Development
⚠️ SENSITIVE - Keep this secret!
```

#### Bước 3: Xác nhận

Click **"Save"** cho mỗi biến. Vercel sẽ tự động redeploy nếu cần.

### Option 2: Qua Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link to project
vercel link

# Add environment variables
vercel env add NEXT_PUBLIC_ZALO_APP_ID
# Enter value when prompted

vercel env add ZALO_APP_SECRET
# Mark as "Secret" when prompted

vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add GEMINI_API_KEY

# Pull environment variables for local development
vercel env pull .env.local
```

### Option 3: Import từ file .env

**⚠️ Cảnh báo**: Chỉ dùng cho development, không commit file này!

```bash
# Tạo file .env.production
cat > .env.production << EOL
NEXT_PUBLIC_ZALO_APP_ID=your_app_id
ZALO_APP_SECRET=your_app_secret
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
GEMINI_API_KEY=your_gemini_key
EOL

# Import vào Vercel
vercel env add < .env.production

# XÓA FILE SAU KHI IMPORT
rm .env.production
```

---

## Deploy lên Vercel

### Method 1: Deploy qua Git (Khuyến nghị)

#### Bước 1: Push code lên GitHub

```bash
git add .
git commit -m "feat: Secure Zalo OAuth with server-side API routes"
git push origin main
```

#### Bước 2: Import Project vào Vercel

1. Vào https://vercel.com/new
2. Chọn repository từ GitHub
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

4. Thêm Environment Variables (xem phần trên)
5. Click **"Deploy"**

### Method 2: Deploy qua Vercel CLI

```bash
# Build và deploy
vercel --prod

# Hoặc deploy từ branch cụ thể
git checkout main
vercel --prod
```

### Method 3: Deploy Preview (Testing)

```bash
# Deploy preview branch
git checkout feature-branch
vercel

# Test preview URL before merging to production
```

---

## Cấu hình Zalo OAuth Redirect URIs

Sau khi deploy, bạn cần cập nhật Redirect URIs trong Zalo Developer Console.

### Bước 1: Lấy Production URL

Vercel sẽ cung cấp URL dạng:
- Production: `https://your-app.vercel.app`
- Custom domain: `https://cpls.yourdomain.com`

### Bước 2: Cập nhật Zalo Developers

1. Vào https://developers.zalo.me/
2. Chọn app của bạn
3. Vào **Settings** > **OAuth Settings**
4. Thêm các Redirect URIs:

```
# Production
https://your-app.vercel.app/auth/callback

# Custom domain (nếu có)
https://cpls.yourdomain.com/auth/callback

# Development (local testing)
http://localhost:3000/auth/callback
```

5. Click **"Save"**

### Bước 3: Test OAuth Flow

1. Truy cập production URL
2. Click "Đăng nhập với Zalo"
3. Authorize trên Zalo
4. Xác nhận redirect về `/auth/callback` thành công
5. Kiểm tra profile được tạo trong Supabase

---

## Kiểm tra sau deploy

### 1. Kiểm tra Environment Variables

```bash
# Via Vercel CLI
vercel env ls

# Output should show:
# NEXT_PUBLIC_ZALO_APP_ID        Production, Preview
# ZALO_APP_SECRET (sensitive)    Production, Preview
# ...
```

### 2. Test API Routes

```bash
# Test health
curl https://your-app.vercel.app/api/health

# Test Zalo token endpoint (should return error without code)
curl -X POST https://your-app.vercel.app/api/auth/zalo/token \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}'

# Should return: {"error": "..."}
```

### 3. Check Vercel Logs

```bash
# Via CLI
vercel logs

# Or via dashboard:
# https://vercel.com/[your-team]/[your-project]/logs
```

### 4. Verify Security

#### Check 1: ZALO_APP_SECRET không bị expose

```bash
# Fetch client bundle
curl https://your-app.vercel.app/_next/static/chunks/app/page.js

# Search for secret (should NOT be found)
# ❌ If found: Secret is exposed! Fix immediately
# ✅ If not found: Good!
```

#### Check 2: HTTPS enforced

```bash
# Try HTTP (should redirect to HTTPS)
curl -I http://your-app.vercel.app/
# Should return: 301 or 308 redirect to https://
```

#### Check 3: CORS headers

```bash
curl -H "Origin: https://evil.com" \
  -X POST https://your-app.vercel.app/api/auth/zalo/token \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}'

# Should block or return CORS error
```

---

## Troubleshooting

### Issue 1: "Zalo OAuth not properly configured"

**Triệu chứng**: Lỗi 500 khi click "Đăng nhập với Zalo"

**Nguyên nhân**: Environment variables chưa được set

**Giải pháp**:
```bash
# Check variables
vercel env ls

# Add missing variables
vercel env add ZALO_APP_SECRET

# Redeploy
vercel --prod
```

### Issue 2: "Invalid redirect URI"

**Triệu chứng**: Zalo trả về lỗi khi redirect

**Nguyên nhân**: Redirect URI chưa được whitelist trong Zalo Console

**Giải pháp**:
1. Vào Zalo Developers > OAuth Settings
2. Thêm: `https://your-app.vercel.app/auth/callback`
3. Đảm bảo URL khớp chính xác (không trailing slash)

### Issue 3: Build failed on Vercel

**Triệu chứng**: Deploy fails với TypeScript errors

**Giải pháp**:
```bash
# Test build locally
npm run build

# If passes locally but fails on Vercel, check Node version
# In vercel.json:
{
  "buildCommand": "npm run build",
  "framework": "nextjs",
  "env": {
    "NODE_VERSION": "18"
  }
}
```

### Issue 4: Environment variables không update

**Triệu chứng**: Đã thay đổi biến nhưng app vẫn dùng giá trị cũ

**Giải pháp**:
```bash
# Force redeploy
vercel --force

# Hoặc qua dashboard: Deployments > ... > Redeploy
```

### Issue 5: API routes trả về 404

**Triệu chứng**: `/api/auth/zalo/token` không hoạt động

**Giải pháp**:
```bash
# Check file structure
ls -la app/api/auth/zalo/token/

# Should have: route.ts

# Rebuild
npm run build
vercel --prod
```

---

## Best Practices cho Production

### 1. Custom Domain

```bash
# Add custom domain
vercel domains add cpls.yourdomain.com

# Configure DNS
# Add CNAME record:
# cpls -> cname.vercel-dns.com
```

### 2. Enable Analytics

1. Vercel Dashboard > Analytics
2. Enable Web Analytics
3. Monitor performance and errors

### 3. Set up Monitoring

```bash
# Install Sentry for error tracking
npm install @sentry/nextjs

# Configure in next.config.js
# Follow: https://docs.sentry.io/platforms/javascript/guides/nextjs/
```

### 4. Environment-specific configs

```javascript
// next.config.js
module.exports = {
  env: {
    API_BASE_URL: process.env.VERCEL_ENV === 'production'
      ? 'https://cpls.yourdomain.com'
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
  }
}
```

### 5. Setup CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

---

## Security Checklist

Trước khi go live, xác nhận:

- [ ] `ZALO_APP_SECRET` không bị expose trong client bundle
- [ ] HTTPS được enforce cho tất cả requests
- [ ] Zalo Redirect URIs chỉ chứa domains tin cậy
- [ ] RLS (Row Level Security) được enable trong Supabase
- [ ] Environment variables được set cho cả Production và Preview
- [ ] CORS headers được cấu hình đúng
- [ ] State parameter được verify trong OAuth callback
- [ ] Error messages không leak sensitive info
- [ ] Logs không chứa access tokens hoặc secrets
- [ ] Rate limiting được implement (via Vercel Edge Config nếu cần)

---

## Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Zalo OAuth Documentation](https://developers.zalo.me/docs/api/social-api/tai-lieu)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## Support

Nếu gặp vấn đề:
1. Check Vercel deployment logs
2. Check browser console errors
3. Verify environment variables
4. Test API routes với curl/Postman
5. Review Zalo Developer Console logs

**Chúc bạn deploy thành công! 🚀**
