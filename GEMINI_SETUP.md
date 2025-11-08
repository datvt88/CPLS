# 🤖 Hướng dẫn cấu hình Gemini AI cho AI Signals

## Vấn đề lỗi 404

Nếu bạn gặp lỗi `HTTP error! status: 404` khi sử dụng AI Signals, có nghĩa là:
1. ❌ Chưa cấu hình GEMINI_API_KEY
2. ❌ Server development chưa chạy
3. ❌ Đang dùng production build cũ

## ✅ Giải pháp

### Bước 1: Tạo file .env.local

```bash
# Copy từ file mẫu
cp .env.local.example .env.local
```

### Bước 2: Lấy Gemini API Key

1. Truy cập: https://makersuite.google.com/app/apikey
2. Đăng nhập bằng Google Account
3. Click "Create API Key" hoặc "Get API Key"
4. Copy API key vừa tạo

### Bước 3: Cấu hình .env.local

Mở file `.env.local` và thêm API key:

```bash
# Gemini AI API Key
GEMINI_API_KEY=AIzaSy... # Paste API key của bạn vào đây
```

### Bước 4: Start Development Server

```bash
# Install dependencies (nếu chưa)
npm install

# Start dev server
npm run dev
```

Server sẽ chạy tại: http://localhost:3000

### Bước 5: Test AI Signals

1. Truy cập: http://localhost:3000/dashboard
2. Tìm widget "AI Signals"
3. Nhập "VNINDEX" vào ô input
4. Click "Phân tích AI"
5. ✅ Sẽ thấy phân tích kỹ thuật chi tiết!

## 🔧 Nếu vẫn lỗi

### Lỗi 500 - API Key không hợp lệ

```
Error: Gemini API key not configured
```

**Giải pháp:**
- Kiểm tra lại GEMINI_API_KEY trong .env.local
- Đảm bảo không có khoảng trắng thừa
- Restart dev server sau khi thay đổi .env.local

### Lỗi 404 - Route không tìm thấy

**Giải pháp:**
```bash
# Stop server (Ctrl+C)
# Restart server
npm run dev
```

### Lỗi từ Gemini API

```
Failed to generate signal from Gemini API
```

**Giải pháp:**
- Kiểm tra API key còn hạn sử dụng
- Kiểm tra quota (Gemini free tier có giới hạn)
- Thử tạo API key mới

## 📊 AI Signals hoạt động như thế nào?

Widget AI Signals sử dụng:

1. **Dữ liệu thực từ VNINDEX**
   - Fetch 50 phiên gần nhất
   - Validate ngày với timezone GMT+7
   - Filter dữ liệu hợp lệ

2. **Tính toán chỉ số kỹ thuật**
   - Bollinger Bands (20, 2)
   - MA10 và MA30
   - Vị trí giá trong band

3. **Logic trading tự động**
   - Giá ≤ 20% band → MUA THĂM DÒ
   - Giá ≥ 80% band → CHỐT LÃI
   - MA10 > MA30 (+2%) → MUA TỶ TRỌNG CAO
   - MA10 < MA30 (-2%) → BÁN TỶ TRỌNG CAO

4. **Phân tích bằng Gemini AI**
   - Nhận context đầy đủ về thị trường
   - Phân tích tổng hợp các tín hiệu
   - Trả về BUY/SELL/HOLD + confidence + summary

## 🎯 Demo Output mẫu

```json
{
  "signal": "BUY",
  "confidence": 75,
  "summary": "VNINDEX đang ở vùng hỗ trợ mạnh gần lower Bollinger Band (vị trí 18% band). MA10 vừa cắt lên MA30 cho thấy xu hướng tăng đang hình thành. Khuyến nghị MUA THĂM DÒ với tỷ trọng 30-40% danh mục, đặt stop loss dưới 1,250 điểm."
}
```

## 🔐 Bảo mật

- ✅ File .env.local đã được thêm vào .gitignore
- ✅ API key KHÔNG được commit lên Git
- ✅ API key chỉ sử dụng server-side (Next.js API route)
- ⚠️ KHÔNG share API key với người khác

## 💡 Tips

1. **Gemini Free Tier**: 60 requests/minute
2. **Tránh spam**: Chỉ phân tích khi cần
3. **Cache**: Kết quả có thể cache 5 phút để tiết kiệm quota
4. **Backup key**: Tạo thêm API key dự phòng

## 📞 Support

Nếu vẫn gặp vấn đề, kiểm tra:
- Console log trong browser (F12)
- Server terminal log
- Network tab để xem request/response
