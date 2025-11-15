# 🚨 Fix Lỗi -14003: Invalid Parameter - Zalo OAuth

## ❌ LỖI HIỆN TẠI

**Error URL:**
```
https://oauth.zaloapp.com/v4/permission/error?error_code=-14003
```

**Error Code:** `-14003`

**Meaning:** Invalid parameter hoặc authentication failed

**When:** Xảy ra NGAY khi redirect sang Zalo (trước khi user authorize)

---

## 🔍 NGUYÊN NHÂN

Lỗi -14003 xảy ra ở authorization step có nghĩa là **parameters gửi lên Zalo không hợp lệ**:

### 1. ❌ App ID Sai hoặc Không Tồn Tại (PHỔ BIẾN NHẤT)

**Symptoms:**
- Error -14003 ngay khi redirect
- URL: `...error?error_code=-14003`

**Causes:**
- App ID trong env variables không đúng
- App ID không tồn tại trên Zalo
- Typo khi copy App ID

**Check:**
```bash
# Console log khi click login
App ID: 1234567890123456

# So sánh với Zalo Console
https://developers.zalo.me/ → App → App ID
```

### 2. ❌ Redirect URI Không Match (PHỔ BIẾN)

**Symptoms:**
- Error -14003 khi redirect
- Redirect URI chưa được đăng ký

**Causes:**
- URI không có trong Zalo OAuth Settings
- URI không match chính xác (http vs https, port, path)
- Trailing slash mismatch

**Check:**
```bash
# Console log
Redirect URI: https://your-app.vercel.app/auth/callback

# So sánh với Zalo Console → OAuth Settings
Phải có CHÍNH XÁC URI này trong danh sách
```

### 3. ❌ App Chưa Active

**Symptoms:**
- Error -14003 ngay khi redirect
- App ở trạng thái Draft/Pending

**Causes:**
- App chưa được submit hoặc approve
- App bị suspended

**Check:**
```
Zalo Console → App → Status
Phải là "Active" hoặc "Live"
```

### 4. ❌ Social API Chưa Enable

**Symptoms:**
- Error -14003 hoặc permission denied

**Causes:**
- Social API không được enable cho app
- Thiếu permissions cần thiết

**Check:**
```
Zalo Console → APIs & Services → Social API
Phải là "Enabled"
```

### 5. ❌ PKCE Parameters Sai Format (HIẾM)

**Symptoms:**
- Error -14003 với valid App ID và Redirect URI

**Causes:**
- code_challenge sai format
- code_challenge_method không phải S256

**Note:** Code hiện tại đã implement PKCE đúng ✅

---

## 🛠️ SOLUTION: DEBUG STEP-BY-STEP

### Bước 1: Sử dụng Debug Tool

**Truy cập:**
```
Development: http://localhost:3000/debug-zalo-auth
Production: https://your-app.vercel.app/debug-zalo-auth
```

**Làm gì:**
1. Click "Generate Authorization URL"
2. Xem full URL và parameters
3. Follow checklist trong page

### Bước 2: Verify App ID

**Check trong Debug Tool:**
```
App ID: 1234567890123456
```

**So sánh với Zalo Console:**
1. Đăng nhập: https://developers.zalo.me/
2. Chọn app
3. Xem App ID (thường ở dashboard hoặc settings)

**Nếu KHÁC nhau:**

**For Development (.env.local):**
```bash
# Fix App ID
NEXT_PUBLIC_ZALO_APP_ID=correct_app_id_here

# Restart dev server
npm run dev
```

**For Production (Vercel):**
```
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Edit NEXT_PUBLIC_ZALO_APP_ID
3. Value = correct_app_id_from_zalo_console
4. Save
5. Redeploy:
   git commit --allow-empty -m "Fix App ID"
   git push origin main
```

### Bước 3: Verify Redirect URI

**Check trong Debug Tool:**
```
Redirect URI: https://your-app.vercel.app/auth/callback
```

**So sánh với Zalo Console:**
1. Zalo Console → App → OAuth Settings (hoặc Redirect URIs)
2. Xem danh sách Redirect URIs đã đăng ký

**Nếu KHÔNG CÓ trong danh sách:**

```
1. Zalo Console → OAuth Settings
2. Add new Redirect URI:
   - Input: https://your-app.vercel.app/auth/callback
   - Click "Add" hoặc "Thêm"
3. Click "Save" hoặc "Lưu"
4. Wait 1-2 minutes
5. Try login again
```

**Common Mistakes:**
```
❌ http://your-app.vercel.app/auth/callback   (should be https)
❌ https://your-app.vercel.app/callback       (missing /auth)
❌ https://your-app.vercel.app/auth/callback/ (trailing slash)
✅ https://your-app.vercel.app/auth/callback  (CORRECT)
```

### Bước 4: Verify App Status

**Check Zalo Console:**
```
Zalo Console → App → Trạng thái / Status
```

**Expected:**
- ✅ **Đang hoạt động** / **Active** / **Live**
- ⚠️ **Test Mode** (OK for development)

**If Draft or Pending:**
```
1. Hoàn thiện thông tin app (logo, description, etc.)
2. Click "Gửi duyệt" / "Submit for Review"
3. Đợi Zalo approve (1-3 ngày làm việc)
4. Check email for approval notification
```

**If Suspended:**
```
Contact Zalo Support:
- Email: developer@zalo.me
- Include: App ID, issue description
```

### Bước 5: Verify Social API

**Check Zalo Console:**
```
Zalo Console → App → APIs & Services → Social API
```

**Expected:**
- Status: **Enabled** / **Đang hoạt động**
- Permissions: ✅ id, name, picture

**If Not Enabled:**
```
1. Click "Enable" / "Kích hoạt"
2. Select permissions:
   ☑ id (user ID)
   ☑ name (user name)
   ☑ picture (user avatar)
3. Click "Save" / "Lưu"
```

---

## ✅ COMPLETE CHECKLIST

### Pre-requisites
- [ ] Có tài khoản Zalo Developer
- [ ] Đã tạo app trên Zalo Console
- [ ] Có App ID và App Secret

### Environment Variables
- [ ] **Development:**
  - [ ] File `.env.local` exists
  - [ ] `NEXT_PUBLIC_ZALO_APP_ID` = [correct App ID]
  - [ ] `ZALO_APP_SECRET` = [correct Secret]
  - [ ] Restart dev server: `npm run dev`

- [ ] **Production (Vercel):**
  - [ ] Vercel → Settings → Environment Variables
  - [ ] `NEXT_PUBLIC_ZALO_APP_ID` = [correct App ID]
  - [ ] `ZALO_APP_SECRET` = [correct Secret]
  - [ ] Environments: ☑ Production ☑ Preview ☑ Development
  - [ ] Redeploy after changes

### Zalo Console Configuration
- [ ] **App ID:**
  - [ ] Copy from Zalo Console
  - [ ] Paste exactly vào env variables
  - [ ] No spaces, no extra characters

- [ ] **Redirect URIs:**
  - [ ] Add: `https://your-app.vercel.app/auth/callback` (Production)
  - [ ] Add: `http://localhost:3000/auth/callback` (Development)
  - [ ] Add custom domain if any
  - [ ] Save changes
  - [ ] Wait 1-2 minutes

- [ ] **App Status:**
  - [ ] Status = "Active" or "Live"
  - [ ] If not → Submit for approval

- [ ] **Social API:**
  - [ ] Social API = "Enabled"
  - [ ] Permissions: id, name, picture
  - [ ] If not → Enable it

### Testing
- [ ] Clear browser cache
- [ ] Visit debug page: `/debug-zalo-auth`
- [ ] Generate Authorization URL
- [ ] Verify all parameters
- [ ] Click "Test OAuth"
- [ ] Should NOT see error -14003 ✅
- [ ] Should redirect to Zalo authorization page ✅

---

## 🧪 DEBUG TOOLS

### Tool 1: Debug Page

**URL:** `/debug-zalo-auth`

**Features:**
- Generate full authorization URL
- Show all OAuth parameters
- Verification checklist
- Test OAuth flow in new tab

### Tool 2: Config Test Page

**URL:** `/test-zalo-config`

**Features:**
- Show current configuration
- Detect environment (dev/prod)
- Display redirect URI
- App ID status

### Tool 3: Console Logs

**Làm gì:**
1. Open Developer Console (F12)
2. Click "Đăng nhập với Zalo"
3. Xem logs:
   ```
   === ZALO OAUTH DEBUG ===
   Current origin: https://your-app.vercel.app
   Redirect URI: https://your-app.vercel.app/auth/callback
   App ID: 1234567890123456
   ========================
   ```

---

## 📊 VERIFICATION MATRIX

| Check | Expected | How to Verify | Fix |
|-------|----------|---------------|-----|
| **App ID** | 16-digit number | Console log vs Zalo Console | Update env vars |
| **Redirect URI** | Exact match | Debug tool vs OAuth Settings | Add to Zalo Console |
| **App Status** | "Active" | Zalo Console → App | Submit for approval |
| **Social API** | "Enabled" | APIs & Services | Enable it |
| **PKCE** | Valid format | Debug tool | Already correct ✅ |

---

## 🎯 COMMON FIXES

### Fix 1: App ID Mismatch

```bash
# Problem: App ID sai
Error: -14003

# Solution:
1. Zalo Console → Copy exact App ID
2. Update env variable:
   NEXT_PUBLIC_ZALO_APP_ID=1234567890123456
3. Restart/Redeploy
4. Test again
```

### Fix 2: Redirect URI Not Registered

```bash
# Problem: URI not in Zalo Console
Error: -14003

# Solution:
1. Debug tool → Copy exact Redirect URI
2. Zalo Console → OAuth Settings
3. Add URI: https://your-app.vercel.app/auth/callback
4. Save
5. Wait 1-2 minutes
6. Test again
```

### Fix 3: App Not Active

```bash
# Problem: App status = Draft
Error: -14003

# Solution:
1. Zalo Console → Complete app info
2. Submit for review
3. Wait for approval
4. OR use test mode during development
```

### Fix 4: Social API Disabled

```bash
# Problem: Social API not enabled
Error: -14003 or permission denied

# Solution:
1. Zalo Console → APIs & Services
2. Social API → Enable
3. Grant permissions: id, name, picture
4. Save
5. Test again
```

---

## 📞 STILL NOT WORKING?

### After checking everything above:

1. **Wait and Retry:**
   - Clear browser cache
   - Wait 5 minutes (Zalo may be updating)
   - Try again

2. **Check Zalo Service Status:**
   - Visit: https://developers.zalo.me/
   - Look for service announcements
   - Check community forum

3. **Contact Zalo Support:**
   ```
   Email: developer@zalo.me

   Include:
   - App ID: [your_app_id]
   - Error: -14003
   - Full authorization URL (from debug tool)
   - Screenshots of:
     * OAuth Settings (redirect URIs)
     * App Status
     * Error page
   ```

---

## 📚 RELATED DOCS

- `docs/VERCEL_ZALO_CONFIG.md` - Complete Vercel setup guide
- `docs/FIX_INVALID_REDIRECT_URI.md` - Redirect URI troubleshooting
- `docs/ZALO_PKCE_IMPLEMENTATION.md` - PKCE implementation details
- `docs/ZALO_VERCEL_SETUP.md` - Vercel deployment guide

---

## ✅ SUCCESS CRITERIA

After fix, you should see:

```
1. Click "Đăng nhập với Zalo"
   ↓
2. Console shows correct App ID and Redirect URI
   ↓
3. Redirect to Zalo (NO error -14003) ✅
   URL: https://oauth.zaloapp.com/v4/permission?app_id=...
   ↓
4. Zalo authorization page appears ✅
   ↓
5. User can authorize
   ↓
6. Redirect back to app ✅
   ↓
7. Login success ✅
```

---

**Created:** 2025-11-15
**Error Code:** -14003
**Priority:** 🔴 Critical - Blocking OAuth Flow
**Status:** Complete Fix Guide ✅
