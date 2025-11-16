# Hướng dẫn Setup Zalo ZNS cho OTP

Tài liệu này hướng dẫn cấu hình Zalo ZNS (Zalo Notification Service) để gửi OTP xác thực qua Zalo.

## 📋 Yêu cầu

1. Tài khoản Zalo Developer
2. Ứng dụng Zalo đã được tạo
3. Supabase project với Service Role Key
4. Vercel deployment (hoặc môi trường Node.js)

## 🔧 Bước 1: Cấu hình Zalo ZNS

### 1.1. Đăng ký ZNS Service

1. Truy cập [Zalo Developer Console](https://developers.zalo.me/)
2. Chọn ứng dụng của bạn
3. Vào **ZNS (Zalo Notification Service)**
4. Click **Kích hoạt ZNS**

### 1.2. Tạo Template OTP

1. Trong ZNS Console, click **Tạo template**
2. Chọn loại: **OTP/Xác thực**
3. Nội dung template ví dụ:
   ```
   Ma xac thuc cua ban la: {{otp_code}}
   Ma co hieu luc trong 5 phut.
   ```
4. Parameter: `otp_code` (type: text)
5. Submit và chờ duyệt (thường 1-2 ngày làm việc)

### 1.3. Lấy Credentials

Sau khi template được duyệt:
1. **Access Token**: Vào **Settings** → **Access Token**
2. **Template ID**: Copy từ danh sách templates đã được duyệt

## 🗄️ Bước 2: Setup Database (Supabase)

### 2.1. Chạy Migration

Tạo bảng `otp_codes` trong Supabase:

```bash
# Cách 1: Sử dụng Supabase CLI
supabase migration up

# Cách 2: Copy SQL từ file và chạy trong Supabase SQL Editor
```

File migration: `supabase/migrations/create_otp_codes_table.sql`

### 2.2. Verify Table

Kiểm tra trong Supabase Dashboard → Table Editor, bạn sẽ thấy table mới:
- `otp_codes` với các columns:
  - `id` (UUID)
  - `phone_number` (TEXT)
  - `otp_code` (TEXT)
  - `expires_at` (TIMESTAMPTZ)
  - `verified` (BOOLEAN)
  - `created_at` (TIMESTAMPTZ)

## 🔐 Bước 3: Cấu hình Environment Variables

### 3.1. Local Development (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Zalo ZNS
ZNS_ACCESS_TOKEN=your_zns_access_token
ZNS_TEMPLATE_ID=your_zns_template_id
```

### 3.2. Vercel Production

1. Vào Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Thêm các biến:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJxxx...` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJxxx...` | Production, Preview |
| `ZNS_ACCESS_TOKEN` | `your_access_token` | Production, Preview |
| `ZNS_TEMPLATE_ID` | `your_template_id` | Production, Preview |

3. Click **Save**
4. **Redeploy** ứng dụng để áp dụng environment variables

## 🧪 Bước 4: Test

### 4.1. Test Local

```bash
# Start development server
npm run dev

# Test send OTP
curl -X POST http://localhost:3000/api/zns/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0912345678"}'

# Response (development mode):
{
  "success": true,
  "message": "OTP sent successfully",
  "debug_otp": "123456",
  "expires_at": 1234567890
}
```

### 4.2. Test Verify OTP

```bash
curl -X POST http://localhost:3000/api/zns/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0912345678","otp":"123456"}'

# Response:
{
  "success": true,
  "message": "OTP verified successfully"
}
```

### 4.3. Test Full Registration Flow

1. Mở ứng dụng: http://localhost:3000
2. Click **Đăng ký ngay**
3. Nhập thông tin:
   - Số điện thoại: 0912345678
   - Email: test@example.com
   - Mật khẩu: Test1234
4. Click **Gửi mã OTP**
5. Nhập OTP (check console logs trong development)
6. Click **Xác thực OTP**
7. Tài khoản được tạo thành công!

## 🔍 Debug

### Lỗi "ZNS service not properly configured"

**Nguyên nhân**: Environment variables chưa được set hoặc tên biến sai

**Giải pháp**:
1. Check Vercel logs:
   ```
   vercel logs your-project-name
   ```
2. Tìm dòng log:
   ```
   === ZNS Configuration Check ===
   ZNS_ACCESS_TOKEN exists: false
   ZNS_TEMPLATE_ID exists: false
   ```
3. Nếu `false`, kiểm tra lại tên biến trong Vercel Settings
4. Đảm bảo đã **Redeploy** sau khi thêm env vars

### Lỗi "Failed to send OTP"

**Nguyên nhân**: ZNS API trả về lỗi

**Giải pháp**:
1. Check Vercel logs để xem chi tiết lỗi từ ZNS:
   ```
   ZNS API error: { error: -124, message: "Template not approved" }
   ```
2. Các lỗi thường gặp:
   - `-124`: Template chưa được duyệt
   - `-216`: Access token không hợp lệ
   - `-214`: Template ID không tồn tại
   - `-201`: Số điện thoại không hợp lệ

### Lỗi "Failed to store OTP"

**Nguyên nhân**: Không kết nối được với Supabase hoặc chưa chạy migration

**Giải pháp**:
1. Verify table `otp_codes` tồn tại trong Supabase
2. Check `SUPABASE_SERVICE_ROLE_KEY` đã được set
3. Check RLS policies đã được tạo đúng

## 📊 Monitoring

### Check OTP trong Database (Development only)

```sql
-- Supabase SQL Editor
SELECT * FROM otp_codes
WHERE phone_number = '0912345678';
```

### Cleanup Expired OTPs

OTPs tự động expire sau 5 phút, nhưng bạn có thể dọn dẹp manual:

```sql
DELETE FROM otp_codes
WHERE expires_at < NOW();
```

Hoặc setup cron job (Vercel Cron hoặc Supabase Edge Functions).

## 🚀 Production Checklist

- [ ] Template ZNS đã được duyệt
- [ ] Environment variables đã set trên Vercel
- [ ] Migration đã chạy thành công trên Supabase
- [ ] Test flow đăng ký hoàn chỉnh
- [ ] Remove `debug_otp` khỏi response (production)
- [ ] Setup monitoring/logging
- [ ] Setup cron job cleanup expired OTPs

## 📞 Support

- Zalo Developer Docs: https://developers.zalo.me/docs/zns
- Supabase Docs: https://supabase.com/docs
- Issues: Liên hệ team nếu gặp vấn đề
