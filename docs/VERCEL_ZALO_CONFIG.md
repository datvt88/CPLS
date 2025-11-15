# ⚙️ Cấu Hình Zalo OAuth trên Vercel - Complete Setup

## 📋 OVERVIEW

Để Zalo OAuth hoạt động trên Vercel, bạn cần cấu hình:
1. ✅ Environment Variables trên Vercel
2. ✅ Redirect URIs trong Zalo Developer Console
3. ✅ App phải ở trạng thái Active

---

## 🔧 BƯỚC 1: CẤU HÌNH VERCEL ENVIRONMENT VARIABLES

### Truy cập Vercel Dashboard

```
1. Đăng nhập: https://vercel.com/
2. Chọn project của bạn
3. Vào: Settings → Environment Variables
```

### Thêm Environment Variables

**Variable 1: NEXT_PUBLIC_ZALO_APP_ID**
```
Name: NEXT_PUBLIC_ZALO_APP_ID
Value: [App ID từ Zalo Console] (VD: 1234567890123456)
Environments: ☑ Production ☑ Preview ☑ Development
```

**Variable 2: ZALO_APP_SECRET**
```
Name: ZALO_APP_SECRET
Value: [App Secret từ Zalo Console]
Environments: ☑ Production ☑ Preview ☑ Development
```

**⚠️ QUAN TRỌNG:**
- `NEXT_PUBLIC_ZALO_APP_ID` - Có prefix `NEXT_PUBLIC_` (public, visible ở client)
- `ZALO_APP_SECRET` - KHÔNG có prefix (secret, chỉ server-side)

### Optional: NEXT_PUBLIC_REDIRECT_URI (Cho Preview Deployments)

```
Name: NEXT_PUBLIC_REDIRECT_URI
Value: https://your-app.vercel.app/auth/callback
Environments: ☐ Production ☑ Preview ☐ Development
```

**Khi nào cần:**
- Nếu bạn muốn Preview deployments dùng chung 1 redirect URI
- Để tránh phải đăng ký mỗi preview URL trong Zalo Console

---

## 📝 BƯỚC 2: LẤY APP ID VÀ SECRET TỪ ZALO

### 2.1. Đăng nhập Zalo Developer Console

```
1. Truy cập: https://developers.zalo.me/
2. Đăng nhập bằng tài khoản Zalo
```

### 2.2. Tạo App (nếu chưa có)

```
1. Click "Tạo ứng dụng mới" hoặc "Create App"
2. Điền thông tin:
   - Tên ứng dụng: [Tên app của bạn]
   - Loại ứng dụng: Web Application
   - Mô tả: [Mô tả ngắn]
3. Click "Tạo" / "Create"
```

### 2.3. Lấy App Credentials

```
1. Chọn app vừa tạo
2. Vào tab "Thông tin ứng dụng" / "App Information"
3. Copy:
   - App ID: [Dãy số dài, VD: 1234567890123456]
   - App Secret: [Chuỗi ký tự random]
```

**Screenshot vị trí:**
```
┌─────────────────────────────────────┐
│ Thông tin ứng dụng                  │
├─────────────────────────────────────┤
│ App ID: 1234567890123456   [Copy]   │
│ App Secret: abc...xyz      [Copy]   │
└─────────────────────────────────────┘
```

---

## 🔗 BƯỚC 3: ĐĂNG KÝ REDIRECT URIs TRONG ZALO CONSOLE

### 3.1. Tìm OAuth Settings

```
1. Trong Zalo Console → Chọn app
2. Tìm menu bên trái:
   - "Cài đặt OAuth" / "OAuth Settings"
   - hoặc "Redirect URIs"
   - hoặc "Cấu hình OAuth"
3. Click vào
```

### 3.2. Xác định Redirect URIs cần đăng ký

**Lấy Vercel domain:**
```
1. Vercel Dashboard → Chọn project
2. Vào: Settings → Domains
3. Xem Production domain (VD: your-app.vercel.app)
```

**URIs cần đăng ký:**

```bash
# 1. PRODUCTION - Vercel Default Domain (BẮT BUỘC)
https://your-app.vercel.app/auth/callback

# 2. PRODUCTION - Custom Domain (nếu có)
https://yourdomain.com/auth/callback

# 3. DEVELOPMENT - Localhost (để test local)
http://localhost:3000/auth/callback
```

**⚠️ Thay `your-app` bằng tên project thực tế của bạn!**

### 3.3. Thêm Redirect URIs

```
1. Trong OAuth Settings
2. Tìm ô "Redirect URI" hoặc "Callback URL"
3. Nhập URI đầu tiên: https://your-app.vercel.app/auth/callback
4. Click "Thêm" / "Add"
5. Lặp lại cho các URIs khác
6. Click "Lưu" / "Save"
7. Đợi 1-2 phút để Zalo cập nhật
```

**Example:**
```
┌─────────────────────────────────────────────────┐
│ Redirect URIs                                   │
├─────────────────────────────────────────────────┤
│ 1. https://your-app.vercel.app/auth/callback    │
│ 2. https://yourdomain.com/auth/callback         │
│ 3. http://localhost:3000/auth/callback          │
│                                                 │
│ [+ Thêm URI]                    [Lưu]          │
└─────────────────────────────────────────────────┘
```

---

## ✅ BƯỚC 4: VERIFY APP STATUS

### 4.1. Kiểm tra App Status

```
1. Zalo Console → App
2. Xem "Trạng thái ứng dụng" / "App Status"
```

**Phải là một trong các trạng thái sau:**
- ✅ **Đang hoạt động** / **Active** / **Live** → OK
- ⚠️ **Test Mode** / **Development** → OK cho development
- ❌ **Nháp** / **Draft** → Cần submit
- ❌ **Chờ duyệt** / **Pending** → Đợi Zalo approve
- ❌ **Tạm ngừng** / **Suspended** → Contact support

**Nếu app chưa Active:**
```
1. Hoàn thiện thông tin app
2. Click "Gửi duyệt" / "Submit for Review"
3. Đợi Zalo approve (1-3 ngày làm việc)
```

### 4.2. Enable Social API

```
1. Zalo Console → App
2. Vào "APIs & Services" hoặc "Dịch vụ API"
3. Tìm "Social API"
4. Click "Kích hoạt" / "Enable"
5. Chọn permissions cần thiết:
   ✅ id (user ID)
   ✅ name (user name)
   ✅ picture (user avatar)
6. Click "Lưu" / "Save"
```

---

## 🧪 BƯỚC 5: TEST CONFIGURATION

### 5.1. Deploy Changes (nếu cần)

```bash
# Nếu vừa thêm env variables
# Trigger redeploy
git commit --allow-empty -m "Trigger redeploy for env vars"
git push origin main
```

### 5.2. Test trên Vercel

**Option 1: Dùng Test Page**

```
1. Truy cập: https://your-app.vercel.app/test-zalo-config
2. Click "Test Configuration"
3. Verify:
   - App ID configured: ✅
   - Redirect URI: https://your-app.vercel.app/auth/callback
4. So sánh redirect URI với Zalo Console
```

**Option 2: Dùng Console Log**

```
1. Truy cập: https://your-app.vercel.app
2. Mở Developer Console (F12)
3. Click "Đăng nhập với Zalo"
4. Xem logs:
   === ZALO OAUTH DEBUG ===
   Current origin: https://your-app.vercel.app
   Redirect URI: https://your-app.vercel.app/auth/callback
   App ID: 1234567890123456
   ⚠️  Make sure this redirect URI is registered!
   ========================
5. Verify App ID và Redirect URI đúng
```

### 5.3. Test OAuth Flow

```
1. Click "Đăng nhập với Zalo"
2. Kiểm tra:
   - ✅ Redirect sang Zalo (không có error -14003)
   - ✅ User authorize
   - ✅ Redirect về app
   - ✅ Login thành công
```

---

## 🚨 TROUBLESHOOTING LỖI -14003

### Error: `https://oauth.zaloapp.com/v4/permission/error?error_code=-14003`

**Ý nghĩa:** Invalid parameter or authentication failed

### Check 1: Verify App ID

```bash
# Console log khi click login:
App ID: 1234567890123456

# So sánh với Vercel env:
Vercel → Settings → Environment Variables
→ NEXT_PUBLIC_ZALO_APP_ID = 1234567890123456

# So sánh với Zalo Console:
Zalo Console → App → App ID = 1234567890123456

# Nếu KHÁC → FIX:
1. Update Vercel env variable với App ID đúng
2. Redeploy
```

### Check 2: Verify Redirect URI

```bash
# Console log:
Redirect URI: https://your-app.vercel.app/auth/callback

# So sánh với Zalo Console → OAuth Settings:
Danh sách Redirect URIs phải có:
✅ https://your-app.vercel.app/auth/callback

# Nếu KHÔNG CÓ → FIX:
1. Zalo Console → OAuth Settings
2. Add: https://your-app.vercel.app/auth/callback
3. Save
4. Đợi 1-2 phút
5. Try lại
```

### Check 3: Verify App Status

```
Zalo Console → App Status

Nếu = "Draft" hoặc "Pending":
1. Complete app info
2. Submit for review
3. Wait for approval

Nếu = "Suspended":
1. Contact Zalo support: developer@zalo.me
```

### Check 4: Verify Social API

```
Zalo Console → APIs & Services → Social API

Phải = "Enabled" / "Đang hoạt động"

Nếu không:
1. Click Enable
2. Grant permissions (id, name, picture)
3. Save
```

---

## 📊 CONFIGURATION SUMMARY

### Vercel Environment Variables

| Variable | Value | Environments | Type |
|----------|-------|--------------|------|
| `NEXT_PUBLIC_ZALO_APP_ID` | 1234567890123456 | All | Public |
| `ZALO_APP_SECRET` | abc123...xyz | All | Secret |
| `NEXT_PUBLIC_REDIRECT_URI` | https://your-app.vercel.app/... | Preview (optional) | Public |

### Zalo Console Settings

| Setting | Value | Status |
|---------|-------|--------|
| **App ID** | 1234567890123456 | ✅ |
| **App Status** | Active | ✅ |
| **Social API** | Enabled | ✅ |
| **Redirect URI #1** | https://your-app.vercel.app/auth/callback | ✅ |
| **Redirect URI #2** | http://localhost:3000/auth/callback | ✅ |
| **Permissions** | id, name, picture | ✅ |

---

## 📝 COMPLETE CHECKLIST

### A. Vercel Configuration
- [ ] Đăng nhập Vercel: https://vercel.com/
- [ ] Chọn project
- [ ] Vào: Settings → Environment Variables
- [ ] Add: `NEXT_PUBLIC_ZALO_APP_ID` = [App ID from Zalo]
- [ ] Add: `ZALO_APP_SECRET` = [Secret from Zalo]
- [ ] Set all environments: Production, Preview, Development
- [ ] Save
- [ ] Trigger redeploy (push commit hoặc manual redeploy)

### B. Zalo Console Configuration
- [ ] Đăng nhập: https://developers.zalo.me/
- [ ] Chọn/Tạo app
- [ ] Copy App ID và Secret → Paste vào Vercel
- [ ] Vào OAuth Settings
- [ ] Add redirect URI: `https://your-app.vercel.app/auth/callback`
- [ ] Add redirect URI: `http://localhost:3000/auth/callback`
- [ ] Save và đợi 1-2 phút
- [ ] Verify App Status = "Active"
- [ ] Verify Social API = "Enabled"

### C. Testing
- [ ] Visit: `https://your-app.vercel.app/test-zalo-config`
- [ ] Verify App ID configured
- [ ] Verify Redirect URI matches
- [ ] Click "Đăng nhập với Zalo"
- [ ] Should redirect to Zalo (no error -14003)
- [ ] Authorize
- [ ] Should redirect back and login ✅

---

## 🎯 EXAMPLE VALUES

**Example App:**
- App Name: "My CPLS App"
- Vercel Domain: `my-cpls-app.vercel.app`
- Custom Domain: `cpls.example.com`

**Vercel Env Variables:**
```bash
NEXT_PUBLIC_ZALO_APP_ID=1234567890123456
ZALO_APP_SECRET=abcdef1234567890xyz
```

**Zalo Redirect URIs:**
```
https://my-cpls-app.vercel.app/auth/callback
https://cpls.example.com/auth/callback
http://localhost:3000/auth/callback
```

---

## 🔗 USEFUL LINKS

- **Vercel Dashboard:** https://vercel.com/
- **Zalo Developer Console:** https://developers.zalo.me/
- **Test Config Page:** `https://your-app.vercel.app/test-zalo-config`
- **Zalo Support:** developer@zalo.me
- **Zalo Community:** https://developers.zalo.me/community

---

## 💡 TIPS

1. **Double-check App ID:**
   - Zalo App ID thường là dãy số 16 chữ số
   - Nếu sai 1 ký tự → Lỗi -14003

2. **Redirect URI must match EXACTLY:**
   - `https` vs `http` → Khác nhau
   - `/auth/callback` vs `/callback` → Khác nhau
   - Trailing slash `/callback/` vs `/callback` → Khác nhau

3. **Wait after changes:**
   - Sau khi save trong Zalo Console → Đợi 1-2 phút
   - Sau khi update Vercel env → Redeploy

4. **Use Test Page:**
   - `/test-zalo-config` để verify config
   - Console logs để debug

5. **Preview Deployments:**
   - Set `NEXT_PUBLIC_REDIRECT_URI` cho Preview environment
   - Để tránh phải đăng ký mỗi preview URL

---

**Created:** 2025-11-15
**For:** Vercel Production Deployment
**Status:** Complete Setup Guide ✅
