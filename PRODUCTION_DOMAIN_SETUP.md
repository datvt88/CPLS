# 🌐 Cấu hình Production Domain - beta.cophieuluotsong.com

## 📋 Redirect URLs cần thêm

Bạn cần thêm production domain vào **2 nơi**:
1. Google Cloud Console (OAuth Credentials)
2. Supabase Dashboard (Redirect URLs)

---

## 1️⃣ Google Cloud Console

### Bước 1: Mở OAuth Credentials
1. Vào https://console.cloud.google.com/
2. Chọn project của bạn
3. **APIs & Services** > **Credentials**
4. Click vào OAuth 2.0 Client ID mà bạn đã tạo

### Bước 2: Thêm Production URLs

**Authorized JavaScript origins:**
```
https://beta.cophieuluotsong.com
http://localhost:3000
```

**Authorized redirect URIs:**
```
https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
https://beta.cophieuluotsong.com/auth/callback
http://localhost:3000/auth/callback
```

**⚠️ Lưu ý:**
- Thay `YOUR-PROJECT-REF` bằng project reference trong Supabase
- Không có dấu `/` ở cuối URLs
- HTTPS bắt buộc cho production

### Bước 3: Save
Click **SAVE** ở cuối trang

---

## 2️⃣ Supabase Dashboard

### Bước 1: Vào Authentication Settings
1. https://app.supabase.com/
2. Chọn project
3. **Authentication** > **URL Configuration**

### Bước 2: Site URL
Đặt Site URL là production domain:
```
https://beta.cophieuluotsong.com
```

### Bước 3: Redirect URLs
Thêm vào **Additional Redirect URLs**:
```
https://beta.cophieuluotsong.com/auth/callback
http://localhost:3000/auth/callback
```

Mỗi URL một dòng.

### Bước 4: Save
Click **Save** ở cuối trang

---

## 3️⃣ Kiểm tra Code đã cập nhật

### ✅ Callback page đã được sửa
File `app/auth/callback/page.tsx` giờ đã hỗ trợ:
- ✅ Google OAuth (Supabase) - Xử lý hash fragments
- ✅ Zalo OAuth - Xử lý code exchange
- ✅ Auto redirect sau khi login thành công
- ✅ Clean URL hash sau callback

### Thay đổi chính:

**Trước (chỉ Zalo):**
```typescript
// Chỉ kiểm tra code parameter
const code = urlParams.get('code')
```

**Sau (Google + Zalo):**
```typescript
// Kiểm tra hash fragments (Google OAuth)
const hashParams = new URLSearchParams(window.location.hash.substring(1))
const accessToken = hashParams.get('access_token')

// Kiểm tra code parameter (Zalo)
const code = urlParams.get('code')

// Handle cả 2 loại
if (accessToken) {
  await handleSupabaseOAuth(...)  // Google
} else if (code) {
  await handleZaloOAuth(...)      // Zalo
}
```

---

## 4️⃣ Test trên Production

### Local testing (localhost:3000)
```bash
npm run dev
# Click "Đăng nhập bằng Google"
# Sẽ redirect đến Google
# Sau khi approve, redirect về localhost:3000/auth/callback
# Auto chuyển về /dashboard
```

### Production testing (beta.cophieuluotsong.com)
1. Deploy code lên production
2. Truy cập https://beta.cophieuluotsong.com
3. Click "Đăng nhập bằng Google"
4. Sẽ redirect đến Google
5. Sau khi approve, redirect về beta.cophieuluotsong.com/auth/callback
6. Auto chuyển về /dashboard

---

## 5️⃣ Flow hoàn chỉnh

```
User clicks "Đăng nhập bằng Google"
    ↓
Redirect to Google OAuth
    ↓
User approves permissions
    ↓
Google redirects to:
  https://YOUR-PROJECT.supabase.co/auth/v1/callback
    ↓
Supabase processes OAuth
    ↓
Supabase redirects to:
  https://beta.cophieuluotsong.com/auth/callback#access_token=...
    ↓
Callback page detects hash fragments
    ↓
Call handleSupabaseOAuth()
    ↓
Get session from Supabase
    ↓
Profile auto-created by AuthListener + DB trigger
    ↓
Clean URL hash
    ↓
Redirect to /dashboard
    ↓
✅ User logged in!
```

---

## 6️⃣ Troubleshooting

### Lỗi: "redirect_uri_mismatch"

**Check:**
```
1. Google Console có đúng redirect URIs?
   ✅ https://YOUR-PROJECT.supabase.co/auth/v1/callback
   ✅ https://beta.cophieuluotsong.com/auth/callback

2. Supabase có đúng redirect URLs?
   ✅ Site URL = https://beta.cophieuluotsong.com
   ✅ Additional Redirect URLs có callback URL
```

### Vẫn thấy token trong URL

**Nguyên nhân:** Callback page chưa chạy hoặc có lỗi.

**Check:**
1. Mở browser console (F12)
2. Xem có log "✅ Google OAuth session established"?
3. Nếu không → Check lỗi trong console

### Session không được tạo

**Check database:**
```sql
-- Xem user mới được tạo chưa
SELECT * FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Xem profile được tạo chưa
SELECT * FROM profiles
ORDER BY created_at DESC
LIMIT 5;
```

### AuthListener không chạy

**Check:**
1. Component `AuthListener` có được import trong `app/layout.tsx`?
2. Trigger `on_auth_user_created` đã tạo trong database?

---

## 7️⃣ Environment Variables

**Không cần thêm env vars mới!**

Google OAuth hoàn toàn được quản lý bởi Supabase, chỉ cần:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 8️⃣ Deploy to Production

### Vercel
```bash
# Đảm bảo env vars đã set
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy
vercel --prod
```

### Netlify
```bash
# Set env vars trong UI hoặc CLI
netlify env:set NEXT_PUBLIC_SUPABASE_URL "https://xxx.supabase.co"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "xxx"

# Deploy
netlify deploy --prod
```

---

## ✅ Checklist

**Google Cloud Console:**
- [ ] Thêm `https://beta.cophieuluotsong.com` vào JS origins
- [ ] Thêm `https://beta.cophieuluotsong.com/auth/callback` vào redirect URIs
- [ ] Thêm `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
- [ ] Save changes

**Supabase Dashboard:**
- [ ] Set Site URL = `https://beta.cophieuluotsong.com`
- [ ] Thêm production callback vào Redirect URLs
- [ ] Save changes

**Code:**
- [ ] Callback page đã được update (done)
- [ ] Commit và push code
- [ ] Deploy to production

**Testing:**
- [ ] Test trên localhost - OK
- [ ] Test trên production - OK
- [ ] Profile được tạo tự động - OK
- [ ] Redirect về dashboard - OK

---

**Domain:** beta.cophieuluotsong.com
**Status:** ✅ Ready for production
**Last Updated:** 2025-01-20
