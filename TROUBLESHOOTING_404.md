# 🔧 Troubleshooting Gemini API 404 Error

## ✅ Fix đã áp dụng

Đã sửa authentication method từ **query parameter** sang **header** (recommended):

```typescript
// ❌ CŨ (gây lỗi 404)
fetch(`...?key=${apiKey}`, { ... })

// ✅ MỚI (đúng chuẩn)
fetch('...', {
  headers: {
    'x-goog-api-key': apiKey
  }
})
```

---

## 🧪 Test API Key trước khi deploy

### Bước 1: Lấy API Key từ Vercel

```bash
# Vào Vercel Dashboard
# Settings → Environment Variables → GEMINI_API_KEY
# Copy value
```

### Bước 2: Test local

```bash
# Test với script đã tạo sẵn
GEMINI_API_KEY=AIzaSy... node scripts/test-gemini-api.js
```

Script sẽ test 3 phương pháp:
1. ✅ Header authentication (recommended)
2. Query parameter (fallback)
3. Gemini-pro model (alternative)

### Output mẫu khi thành công:

```
🔑 API Key found: AIzaSy...

📡 Testing Gemini API...

Test 1: Using x-goog-api-key header
Status: 200 OK
✅ Success! Response: Xin chào thế giới

---

Test 2: Using query parameter
Status: 200 OK
✅ Success! Response: Xin chào thế giới

---

Test 3: Using gemini-pro model
Status: 200 OK
✅ Success! Response: Xin chào thế giới
```

---

## 🚨 Nếu vẫn lỗi 404

### Kiểm tra 1: API Key có đúng không?

```bash
# Test API key trực tiếp
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent" \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

**Kết quả mong đợi:** Status 200 + JSON response

**Nếu 404:** API key sai hoặc model không tồn tại

**Nếu 403:** API key bị disable hoặc không có quyền

### Kiểm tra 2: Vercel Environment Variable

1. Vào Vercel Project Settings
2. Environment Variables
3. Kiểm tra `GEMINI_API_KEY`:
   - ✅ Key name đúng chính xác: `GEMINI_API_KEY`
   - ✅ Value không có khoảng trắng đầu/cuối
   - ✅ Applied to: Production, Preview, Development

4. **Sau khi thay đổi env var → PHẢI REDEPLOY**

### Kiểm tra 3: Logs trên Vercel

```
Vercel Dashboard → Deployments → [Latest] → Runtime Logs
```

Tìm logs:
```
🔄 Calling Gemini API for prompt: VNINDEX
📝 Market context available: true
📡 Gemini API response status: ???
```

---

## 🔍 Debug Chi Tiết

### Nếu status = 404

**Nguyên nhân:**
- Model name sai
- Endpoint URL sai
- API version không đúng

**Giải pháp:** Thử các models khác:
- `gemini-1.5-flash` (current)
- `gemini-1.5-pro`
- `gemini-pro`

### Nếu status = 403

**Nguyên nhân:**
- API key không hợp lệ
- API key bị disable
- Vượt quota

**Giải pháp:**
1. Tạo API key mới tại: https://makersuite.google.com/app/apikey
2. Update lại trong Vercel
3. Redeploy

### Nếu status = 429

**Nguyên nhân:**
- Rate limit exceeded (60 req/min)
- Quota hết

**Giải pháp:**
- Đợi 1 phút rồi thử lại
- Upgrade Gemini plan nếu cần

---

## 📋 Checklist Debug

- [ ] GEMINI_API_KEY có trong Vercel env vars
- [ ] API key không có khoảng trắng
- [ ] Đã test API key bằng curl/script
- [ ] Đã redeploy sau khi thay đổi env var
- [ ] Kiểm tra Runtime Logs trên Vercel
- [ ] Build thành công locally (`npm run build`)

---

## 🆘 Nếu tất cả đều fail

### Plan B: Tạo API key mới

1. Vào: https://makersuite.google.com/app/apikey
2. (Tùy chọn) Delete API key cũ
3. Create new API key
4. Copy key mới
5. Update trong Vercel env vars
6. **REDEPLOY**
7. Test lại

### Plan C: Kiểm tra API availability

```bash
# Test xem Gemini API có online không
curl "https://generativelanguage.googleapis.com/v1beta/models" \
  -H "x-goog-api-key: YOUR_KEY"
```

Kết quả sẽ show danh sách models available.

---

## ✅ Khi đã fix xong

Sau khi fix, test AI Signals:

1. Vào `/dashboard`
2. Widget "AI Signals"
3. Nhập "VNINDEX"
4. Click "Phân tích AI"
5. Đợi 3-5 giây
6. ✅ Nhận được kết quả:
   ```json
   {
     "signal": "BUY/SELL/HOLD",
     "confidence": 75,
     "summary": "Phân tích chi tiết..."
   }
   ```

---

## 📞 Support

Nếu vẫn lỗi, check:
- Browser Console (F12)
- Network tab → `/api/gemini` request
- Vercel Runtime Logs

Cung cấp thông tin:
- Status code
- Error message
- Request/response trong Network tab
