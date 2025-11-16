# 🎯 TÌMTHẤY! CÁCH CONFIG REDIRECT URI TRONG ZALO CONSOLE

## ✅ ZALO VẪN CẦN REDIRECT URI!

**Vấn đề:** Redirect URI không ở "OAuth Settings" mà ở **"Login Settings"**!

---

## 📍 ĐÚNG URL ĐỂ CONFIG

### Cách 1: Truy cập trực tiếp (RECOMMENDED)

**URL Pattern:**
```
https://developers.zalo.me/app/<YOUR_APP_ID>/login
```

**Thay `<YOUR_APP_ID>` bằng App ID thực của bạn:**
```
VD: Nếu App ID = 1234567890123456
→ https://developers.zalo.me/app/1234567890123456/login
```

### Cách 2: Navigation trong Console

```
1. Đăng nhập: https://developers.zalo.me/
2. Chọn app của bạn
3. Tìm menu bên trái hoặc tabs:
   → "Cấu hình" hoặc "Settings"
   → "Đăng nhập" hoặc "Login"
4. Tìm field "Callback URL" hoặc "URL Callback"
```

---

## 🔧 CÁCH CẤU HÌNH

### Bước 1: Xác định App ID

**Lấy từ console log:**
1. F12 → Console
2. Click "Đăng nhập với Zalo"
3. Xem log:
   ```
   App ID: 1234567890123456
   ```
4. Copy App ID này

### Bước 2: Truy cập Login Settings

**Paste App ID vào URL:**
```
https://developers.zalo.me/app/1234567890123456/login
```

### Bước 3: Set Callback URL

**Trong page Login Settings, tìm:**
- Field: **"Callback URL"** hoặc **"URL Callback"** hoặc **"Redirect URI"**

**Nhập các URLs sau:**

```
# Development (localhost)
http://localhost:3000/auth/callback

# Production (Vercel)
https://your-app.vercel.app/auth/callback

# Custom Domain (nếu có)
https://yourdomain.com/auth/callback
```

**⚠️ LƯU Ý:**
- Có thể chỉ nhập 1 URL, hoặc nhiều URLs (phân cách bằng dấu phẩy)
- Format: Mỗi URL 1 dòng hoặc ngăn cách bằng `,` hoặc `;`

### Bước 4: Verify Domain (Nếu cần)

**Một số app type yêu cầu verify domain:**

```
URL: https://developers.zalo.me/app/<YOUR_APP_ID>/verify-domain

Làm gì:
1. Nhập domain: your-app.vercel.app
2. Download verification file
3. Upload lên root của web
4. Click "Verify"
```

**Note:** Vercel apps thường không cần bước này cho development.

### Bước 5: Save và Test

```
1. Click "Lưu" hoặc "Save" hoặc "Cập nhật"
2. Đợi 1-2 phút
3. Try login lại
4. Should work! ✅
```

---

## 📊 CALLBACK URL FORMAT

### Đúng Format

```bash
✅ http://localhost:3000/auth/callback              # Development
✅ https://your-app.vercel.app/auth/callback        # Production
✅ https://yourdomain.com/auth/callback             # Custom domain
```

### Sai Format

```bash
❌ http://localhost:3000/auth/callback/             # Trailing slash
❌ https://your-app.vercel.app/callback             # Missing /auth
❌ your-app.vercel.app/auth/callback                # Missing https://
❌ https://your-app.vercel.app/auth/callback?test   # Query params
```

---

## 🔍 NẾU VẪN KHÔNG TÌM THẤY

### Check 1: App Type

**Một số app types có UI khác nhau:**
- **Web Application** → Có Login Settings
- **Mobile Application** → Có thể khác
- **Official Account (OA)** → Config ở chỗ khác

**Check app type:**
```
Zalo Console → App → Thông tin cơ bản → Loại ứng dụng
```

### Check 2: Official Account (OA)

**Nếu app là Official Account:**
```
1. Vào OA settings
2. Tìm "Official Account Callback URL"
3. Paste callback URL
4. Click Update
```

### Check 3: App Settings Tab

**Thử URLs khác:**
```
# Settings general
https://developers.zalo.me/app/<YOUR_APP_ID>/settings

# Permissions
https://developers.zalo.me/app/<YOUR_APP_ID>/permissions

# Platform settings
https://developers.zalo.me/app/<YOUR_APP_ID>/platforms
```

---

## 🛠️ ALTERNATIVE: NO PRE-REGISTRATION

**Nếu thực sự KHÔNG CÓ chỗ config Callback URL:**

Có khả năng Zalo OAuth v4 **KHÔNG YÊU CẦU** pre-register redirect URI.

**Trong trường hợp này:**

### Option 1: Tắt "Check secret key"

Theo documentation, có option:
```
"Check the secret key when calling API to get the access token"
```

**Turn OFF** option này nếu dùng client-side OAuth.

**Tìm ở:**
```
https://developers.zalo.me/app/<YOUR_APP_ID>/settings
→ Security settings
→ Tắt "Check secret key"
```

### Option 2: Để Zalo tự accept

Một số Zalo apps tự động accept bất kỳ redirect URI nào từ **verified domains**.

**Verify domain:**
```
1. https://developers.zalo.me/app/<YOUR_APP_ID>/verify-domain
2. Add domain: your-app.vercel.app
3. Follow verification steps
4. After verified → Any callback URL from this domain should work
```

---

## 📝 RECOMMENDED ACTION

### Bước 1: Try Direct URL

```bash
# Thay YOUR_APP_ID bằng App ID thực
https://developers.zalo.me/app/YOUR_APP_ID/login
```

### Bước 2: Nếu không có field Callback URL

**Check App Type:**
```
Zalo Console → App Info → App Type

If "Official Account" → Use OA settings
If "Web App" → Should have Login settings
If "Mobile App" → May have different UI
```

### Bước 3: Screenshot và Share

**Nếu vẫn không tìm thấy:**
1. Screenshot Zalo Console menu/tabs
2. Share để tôi có thể hướng dẫn cụ thể hơn

---

## 🎯 TÓM TẮT

| Câu hỏi | Trả lời |
|---------|---------|
| **Có cần config Redirect URI không?** | ✅ CÓ - Zalo vẫn cần |
| **Ở đâu?** | Login Settings hoặc App Settings |
| **URL?** | `https://developers.zalo.me/app/<APP_ID>/login` |
| **Field name?** | "Callback URL" hoặc "URL Callback" |
| **Format?** | `https://your-app.vercel.app/auth/callback` |
| **Nếu không tìm thấy?** | Check app type, hoặc verify domain |

---

## 💡 QUICK TEST

**Thử ngay:**

1. **Get your App ID:**
   ```
   F12 → Console → Click login
   App ID: 1234567890123456
   ```

2. **Visit:**
   ```
   https://developers.zalo.me/app/1234567890123456/login
   ```

3. **Look for:**
   - "Callback URL" field
   - "URL Callback" field
   - "Redirect URI" field

4. **Add:**
   ```
   https://your-app.vercel.app/auth/callback
   ```

5. **Save và test**

---

**Nếu vẫn không tìm thấy, hãy cho tôi biết app type và tôi sẽ hướng dẫn cụ thể hơn!**
