# 🚀 Zalo OAuth Setup cho Vercel - Complete Guide

## ✅ API Keys đã được config trên Vercel

Giả sử bạn đã set environment variables trên Vercel:
- ✅ `NEXT_PUBLIC_ZALO_APP_ID`
- ✅ `ZALO_APP_SECRET`

**Vấn đề còn lại:** Đăng ký **Redirect URIs** trong Zalo Developer Console

---

## 🎯 Vấn Đề với Vercel Deployments

### Vercel tạo NHIỀU domains khác nhau:

```
1. Production: https://your-app.vercel.app
2. Production (custom): https://yourdomain.com
3. Preview (PR): https://your-app-git-branch-team.vercel.app
4. Preview (commit): https://your-app-abc123.vercel.app
```

**→ Mỗi domain cần 1 redirect URI riêng!**

---

## 📋 Các Redirect URIs Cần Đăng Ký

### Bước 1: Identify Your Vercel Domains

**Check trong Vercel Dashboard:**
1. Truy cập: https://vercel.com/
2. Chọn project của bạn
3. Vào **Settings** → **Domains**
4. Xem tất cả domains đang active

**Common domains:**
- **Production:** `https://your-app.vercel.app`
- **Custom domain:** `https://yourdomain.com`
- **Preview branches:** `https://your-app-git-*-team.vercel.app`

### Bước 2: Register URIs trong Zalo Console

**Truy cập Zalo Developer Console:**
1. Đăng nhập: https://developers.zalo.me/
2. Chọn app của bạn
3. Tìm **"OAuth Settings"** hoặc **"Redirect URIs"**
4. Thêm TẤT CẢ các URIs sau:

```
# Production - Vercel domain
https://your-app.vercel.app/auth/callback

# Production - Custom domain (nếu có)
https://yourdomain.com/auth/callback

# Development - Localhost
http://localhost:3000/auth/callback

# Optional: Staging/Preview (nếu dùng)
https://staging.yourdomain.com/auth/callback
```

**⚠️ LƯU Ý:**
- Phải là `https://` (có SSL) cho production
- Phải có `/auth/callback` ở cuối
- KHÔNG có trailing slash: `/auth/callback/` ❌
- Phải match CHÍNH XÁC 100%

### Bước 3: Xử lý Preview Deployments

**Vấn đề:** Vercel preview deployments có random URLs
- `https://your-app-git-feature-team.vercel.app`
- `https://your-app-abc123.vercel.app`

**Giải pháp 1: Wildcard (Nếu Zalo support)**

Nếu Zalo hỗ trợ wildcard patterns:
```
https://*.vercel.app/auth/callback
```

**Giải pháp 2: Set Production URL Override (Recommended)**

Dùng env variable để force preview deployments redirect về production URL:

**Vercel Environment Variables:**
```bash
# Set for Preview deployments only
NEXT_PUBLIC_REDIRECT_URI=https://your-app.vercel.app/auth/callback
```

---

## 🔧 Code Đã Được Fix

### ZaloLoginButton.tsx (line 34-35)

Code hiện tại đã support override:

```typescript
// Support override via env variable for testing
const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI ||
                    `${window.location.origin}/auth/callback`
```

**Cách hoạt động:**
1. **Có `NEXT_PUBLIC_REDIRECT_URI`** → Dùng giá trị này
2. **Không có** → Auto-detect từ `window.location.origin`

---

## ⚙️ Cấu Hình Vercel Environment Variables

### Option 1: Production Only (Simple)

**Không cần set gì thêm** - code tự động detect domain:
- Production: auto-detect `https://your-app.vercel.app`
- Preview: auto-detect `https://your-app-abc123.vercel.app`

**→ Nhưng phải đăng ký TỪNG preview URL (không practical)**

### Option 2: Force Production URL cho Previews (Recommended)

**Set trong Vercel Dashboard:**

1. Vào Project → **Settings** → **Environment Variables**

2. Add variable:
   ```
   Name: NEXT_PUBLIC_REDIRECT_URI
   Value: https://your-app.vercel.app/auth/callback
   Environment: Preview
   ```

3. Add variable cho Production (để test):
   ```
   Name: NEXT_PUBLIC_REDIRECT_URI
   Value: https://yourdomain.com/auth/callback (nếu có custom domain)
   Environment: Production
   ```

**Screenshot guide:**
```
┌────────────────────────────────────────┐
│ Environment Variables                  │
├────────────────────────────────────────┤
│ Name: NEXT_PUBLIC_REDIRECT_URI         │
│ Value: https://your-app.vercel.app/... │
│ Environments:                          │
│   ☐ Production                         │
│   ☑ Preview                            │
│   ☐ Development                        │
│                                        │
│ [Save]                                 │
└────────────────────────────────────────┘
```

### Option 3: Separate URIs for Prod and Preview

```bash
# Production
NEXT_PUBLIC_REDIRECT_URI=https://yourdomain.com/auth/callback

# Preview
NEXT_PUBLIC_REDIRECT_URI=https://your-app.vercel.app/auth/callback
```

---

## 🧪 Testing Plan

### Test 1: Production Deployment

```bash
# 1. Deploy to production
git push origin main

# 2. Visit production URL
https://your-app.vercel.app

# 3. Open DevTools Console (F12)

# 4. Click "Đăng nhập với Zalo"

# 5. Check console log:
=== ZALO OAUTH DEBUG ===
Current origin: https://your-app.vercel.app
Redirect URI: https://your-app.vercel.app/auth/callback
========================

# 6. Verify this URI is in Zalo Console
# 7. Complete OAuth flow
# 8. Should redirect back successfully ✅
```

### Test 2: Preview Deployment

```bash
# 1. Create PR or push to branch
git push origin feature-branch

# 2. Vercel creates preview: https://your-app-git-feature-team.vercel.app

# 3. Visit preview URL

# 4. Click login → Check console

# 5. If using NEXT_PUBLIC_REDIRECT_URI:
Redirect URI: https://your-app.vercel.app/auth/callback (production)

# 6. If not using override:
Redirect URI: https://your-app-git-feature-team.vercel.app/auth/callback
→ Need to register this in Zalo Console ❌ (not practical)
```

### Test 3: Custom Domain

```bash
# 1. If you have custom domain: https://yourdomain.com

# 2. Add domain in Vercel → Settings → Domains

# 3. Set NEXT_PUBLIC_REDIRECT_URI (Production):
https://yourdomain.com/auth/callback

# 4. Register in Zalo Console:
https://yourdomain.com/auth/callback

# 5. Test login on custom domain
# 6. Should work ✅
```

---

## 📝 Complete Checklist

### A. Zalo Developer Console

- [ ] Đăng nhập https://developers.zalo.me/
- [ ] Chọn app của bạn
- [ ] Tìm OAuth Settings
- [ ] Thêm URIs:
  - [ ] `https://your-app.vercel.app/auth/callback` (Vercel production)
  - [ ] `https://yourdomain.com/auth/callback` (Custom domain, if any)
  - [ ] `http://localhost:3000/auth/callback` (Development)
- [ ] Click **Save**
- [ ] Đợi 1-2 phút

### B. Vercel Environment Variables

- [ ] Đã set: `NEXT_PUBLIC_ZALO_APP_ID` ✅
- [ ] Đã set: `ZALO_APP_SECRET` ✅
- [ ] Optional: Set `NEXT_PUBLIC_REDIRECT_URI` cho Preview deployments
  - Environment: **Preview**
  - Value: `https://your-app.vercel.app/auth/callback`

### C. Testing

- [ ] Test trên Production: `https://your-app.vercel.app`
  - [ ] Click login
  - [ ] Check console log
  - [ ] Verify redirect URI
  - [ ] Complete OAuth
  - [ ] Redirect back successfully

- [ ] Test trên Custom domain (if any): `https://yourdomain.com`
  - [ ] Click login
  - [ ] Verify works

- [ ] Test trên Preview deployment (optional)
  - [ ] Create PR
  - [ ] Visit preview URL
  - [ ] Test login

### D. Verify Current Config

- [ ] Visit: `https://your-app.vercel.app/test-zalo-config`
- [ ] Click "Test Configuration"
- [ ] Verify redirect URI matches Zalo Console

---

## 🚨 Troubleshooting

### Error: "Invalid redirect URI" trên Vercel

**Symptoms:**
```
Zalo returns error: Invalid redirect URI
```

**Debug:**

1. **Check console log:**
   ```javascript
   // Should show in browser console
   Redirect URI: https://your-actual-domain.vercel.app/auth/callback
   ```

2. **Visit test page:**
   ```
   https://your-app.vercel.app/test-zalo-config
   ```

3. **Compare with Zalo Console:**
   - URI in log === URI in Zalo Console?
   - Exact match? (https, domain, path)

**Solutions:**

**Solution 1: Add missing URI**
```
Go to Zalo Console → OAuth Settings
Add: https://your-actual-domain.vercel.app/auth/callback
```

**Solution 2: Use env variable override**
```
Vercel → Settings → Environment Variables
Add: NEXT_PUBLIC_REDIRECT_URI=https://your-app.vercel.app/auth/callback
Set for: Preview (hoặc Production)
```

**Solution 3: Check for typos**
```
Common mistakes:
❌ http://your-app.vercel.app  (should be https)
❌ https://your-app.vercel.app/auth/callback/  (trailing slash)
❌ https://your-app.vercel.app/callback  (missing /auth)
✅ https://your-app.vercel.app/auth/callback  (correct)
```

### Error: Environment variables not found

**Symptoms:**
```
Error: Zalo App ID not configured
```

**Solution:**
```
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Verify these exist:
   - NEXT_PUBLIC_ZALO_APP_ID
   - ZALO_APP_SECRET
3. Check environment (Production/Preview/Development)
4. Redeploy after adding variables
```

### Preview URLs changing constantly

**Problem:**
```
Each PR creates new URL:
- PR #1: https://your-app-git-feat1-team.vercel.app
- PR #2: https://your-app-git-feat2-team.vercel.app
Can't register all in Zalo Console
```

**Solution:**
```
Use NEXT_PUBLIC_REDIRECT_URI for Preview:

Vercel → Environment Variables
Name: NEXT_PUBLIC_REDIRECT_URI
Value: https://your-app.vercel.app/auth/callback
Environment: ☑ Preview

→ All previews will redirect to production URL for OAuth
```

---

## 📚 Related Docs

- **Fix Invalid Redirect URI:** `docs/FIX_INVALID_REDIRECT_URI.md`
- **Vercel Deployment:** `docs/VERCEL_DEPLOYMENT.md`
- **PKCE Implementation:** `docs/ZALO_PKCE_IMPLEMENTATION.md`
- **Mobile OAuth:** `docs/ZALO_MOBILE_OAUTH_FLOW.md`

---

## 🎯 Quick Start Commands

```bash
# 1. Verify build works
npm run build

# 2. Check Vercel domains
vercel domains ls

# 3. Deploy to production
git push origin main

# 4. Visit production
open https://your-app.vercel.app

# 5. Test login
open https://your-app.vercel.app/test-zalo-config

# 6. Check logs
vercel logs
```

---

## ✅ Expected Result

```
1. User clicks "Đăng nhập với Zalo" on Vercel
   ↓
2. Console shows: Redirect URI: https://your-app.vercel.app/auth/callback
   ↓
3. User redirects to Zalo (no error)
   ↓
4. User authorizes
   ↓
5. Zalo redirects back: https://your-app.vercel.app/auth/callback?code=XXX
   ↓
6. Token exchange success
   ↓
7. User logged in ✅
```

---

**Created:** 2025-11-15
**For:** Vercel Production Deployment
**Status:** Production Ready ✅
