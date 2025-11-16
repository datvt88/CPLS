# 🚀 Zalo ZNS Setup Guide

## Hướng dẫn thiết lập Zalo ZNS để gửi OTP

### 📋 Tổng quan

Zalo ZNS (Zalo Notification Service) là dịch vụ gửi tin nhắn thông báo của Zalo. Để gửi OTP qua Zalo ZNS, bạn cần:

1. Đăng ký Zalo Official Account (OA)
2. Tạo và phê duyệt Template Message cho OTP
3. Lấy API credentials
4. Tích hợp vào ứng dụng

---

## Bước 1: Đăng ký Zalo Official Account (OA)

### 1.1. Truy cập Zalo OA Console

Truy cập: https://oa.zalo.me/

### 1.2. Đăng ký OA mới

1. Click "Tạo Official Account"
2. Chọn loại tài khoản:
   - **Doanh nghiệp**: Cần giấy phép kinh doanh
   - **Cá nhân**: Dùng CMND/CCCD

### 1.3. Điền thông tin

```
Tên OA: CPLS - Cổ Phiếu Luôn Tăng
Danh mục: Tài chính / Chứng khoán
Mô tả: Ứng dụng phân tích cổ phiếu và giao dịch
```

### 1.4. Xác minh tài khoản

- Gửi giấy tờ theo yêu cầu
- Chờ 1-3 ngày làm việc để được duyệt

---

## Bước 2: Đăng ký sử dụng Zalo ZNS

### 2.1. Truy cập ZNS Console

Sau khi OA được duyệt, truy cập: https://zns.zalo.me/

### 2.2. Kích hoạt dịch vụ ZNS

1. Đăng nhập bằng tài khoản OA
2. Click "Kích hoạt ZNS"
3. Đồng ý điều khoản sử dụng
4. Nạp tiền vào tài khoản (tối thiểu 100,000 VND)

### 2.3. Chi phí

```
- Tin nhắn ZNS: ~200-300 VND/tin
- Tin nhắn SMS fallback: ~500-700 VND/tin
- Tối thiểu: 100,000 VND (≈ 400-500 OTP)
```

---

## Bước 3: Tạo Template cho OTP

### 3.1. Truy cập Template Manager

1. Vào ZNS Console → "Quản lý Template"
2. Click "Tạo Template mới"

### 3.2. Thông tin Template

**Tên Template**: `CPLS_OTP_VERIFICATION`

**Loại Template**: Xác thực OTP

**Nội dung Template**:

```
Ma xac thuc cua ban la: {{otp_code}}.
Ma co hieu luc trong {{expire_time}} phut.
Vui long khong chia se ma nay.
```

**Lưu ý**:
- Không được dùng dấu, phải viết không dấu
- Tối đa 200 ký tự
- Phải có các biến động {{param_name}}

### 3.3. Cấu hình Template Parameters

```json
{
  "otp_code": {
    "type": "string",
    "description": "Mã OTP 6 chữ số",
    "example": "123456"
  },
  "expire_time": {
    "type": "string",
    "description": "Thời gian hết hạn (phút)",
    "example": "5"
  }
}
```

### 3.4. Gửi duyệt Template

1. Click "Gửi duyệt"
2. Chờ 1-2 ngày làm việc
3. Kiểm tra email để biết kết quả

**Lý do bị từ chối thường gặp**:
- Nội dung vi phạm chính sách Zalo
- Template quá dài hoặc thiếu thông tin
- Sai format biến động

---

## Bước 4: Lấy API Credentials

### 4.1. Lấy OA ID

1. Vào OA Console → Settings
2. Copy **OA ID** (dạng: 1234567890123456)

### 4.2. Lấy Access Token

**Option 1: Refresh Token (Khuyến nghị)**

1. Vào https://developers.zalo.me/
2. Chọn app của bạn
3. Vào "OAuth Settings"
4. Generate Refresh Token
5. Copy **Refresh Token**

**Option 2: Access Token trực tiếp**

1. Vào ZNS Console → API Settings
2. Generate Access Token
3. Copy **Access Token** (có hạn 90 ngày)

### 4.3. Lấy App Credentials

1. Vào https://developers.zalo.me/
2. Chọn app của bạn
3. Copy:
   - **App ID**
   - **App Secret Key**

---

## Bước 5: Cấu hình Environment Variables

Thêm vào file `.env.local`:

```bash
# Zalo ZNS Configuration
ZALO_OA_ID=your_oa_id_here
ZALO_APP_ID=your_app_id_here
ZALO_APP_SECRET=your_app_secret_here

# Option 1: Use Refresh Token (Recommended)
ZALO_REFRESH_TOKEN=your_refresh_token_here

# Option 2: Use Access Token directly (expires in 90 days)
# ZALO_ACCESS_TOKEN=your_access_token_here

# ZNS Template ID (after approval)
ZALO_ZNS_TEMPLATE_ID=your_template_id_here
```

**Trong Vercel/Production**:

1. Vào Vercel Dashboard → Settings → Environment Variables
2. Thêm tất cả các biến trên
3. Redeploy project

---

## Bước 6: Test API Integration

### 6.1. Test Access Token

```bash
curl -X GET "https://oauth.zaloapp.com/v4/oa/access_token" \
  -H "secret_key: YOUR_APP_SECRET" \
  -d "app_id=YOUR_APP_ID" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"
```

**Response thành công**:
```json
{
  "access_token": "your_new_access_token",
  "expires_in": 7776000
}
```

### 6.2. Test Send ZNS

```bash
curl -X POST "https://business.openapi.zalo.me/message/template" \
  -H "access_token: YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "84901234567",
    "template_id": "YOUR_TEMPLATE_ID",
    "template_data": {
      "otp_code": "123456",
      "expire_time": "5"
    },
    "tracking_id": "test_' $(date +%s) '"
  }'
```

**Response thành công**:
```json
{
  "error": 0,
  "message": "Success",
  "data": {
    "msg_id": "abc123def456",
    "sent_time": "1234567890"
  }
}
```

**Lỗi thường gặp**:

| Error Code | Ý nghĩa | Cách fix |
|------------|---------|----------|
| -124 | Access token không hợp lệ | Refresh lại token |
| -216 | Template chưa được duyệt | Chờ duyệt template |
| -217 | Template data sai format | Check lại parameters |
| -218 | Số điện thoại không hợp lệ | Phải có mã quốc gia 84 |
| -219 | OA chưa được duyệt | Chờ duyệt OA |

---

## Bước 7: Verify Setup

Sau khi setup xong, verify bằng debug page:

1. Run project: `npm run dev`
2. Truy cập: http://localhost:3000/test-otp-debug
3. Nhập số điện thoại test
4. Click "Send OTP"
5. Check logs và tin nhắn Zalo

---

## 📊 Cost Estimation

**Ví dụ với 1000 users/tháng**:

```
Scenario 1: Mỗi user đăng ký 1 lần
- OTP requests: 1000
- Cost: 1000 × 300 VND = 300,000 VND (~$12)

Scenario 2: Mỗi user đăng nhập 5 lần/tháng
- OTP requests: 5000
- Cost: 5000 × 300 VND = 1,500,000 VND (~$60)

Scenario 3: 50% resend OTP (thất bại lần đầu)
- OTP requests: 1000 + 500 = 1500
- Cost: 1500 × 300 VND = 450,000 VND (~$18)
```

**So sánh với Twilio SMS**:
- Twilio: $0.05/SMS × 1000 = $50
- Zalo ZNS: $12
- **Tiết kiệm: 76%** 🎉

---

## 🔒 Security Best Practices

### 7.1. Bảo vệ Credentials

```bash
# NEVER commit these to git
.env.local
.env.production

# Add to .gitignore
echo ".env*.local" >> .gitignore
```

### 7.2. Rotate Access Tokens

- Refresh access token mỗi 30 ngày
- Không hardcode token trong code
- Dùng environment variables

### 7.3. Rate Limiting

```typescript
// Implement rate limiting
const MAX_OTP_PER_PHONE = 3 // per hour
const MAX_OTP_PER_IP = 10 // per hour
```

### 7.4. Monitor Usage

1. Check ZNS Console daily
2. Set up alerts khi balance < 50,000 VND
3. Track OTP success rate

---

## 📝 Checklist

Trước khi deploy production:

- [ ] OA đã được Zalo duyệt
- [ ] ZNS đã được kích hoạt
- [ ] Đã nạp tiền vào tài khoản (min 100k VND)
- [ ] Template OTP đã được duyệt
- [ ] Đã lấy OA ID, App ID, App Secret
- [ ] Đã generate Refresh Token
- [ ] Đã test gửi OTP thành công
- [ ] Đã cấu hình environment variables
- [ ] Đã implement rate limiting
- [ ] Đã test với số điện thoại thật

---

## 🆘 Troubleshooting

### Template bị từ chối nhiều lần

**Giải pháp**:
1. Liên hệ Zalo Support: support@zalo.me
2. Gửi kèm:
   - OA ID
   - Nội dung template
   - Mục đích sử dụng
   - Giấy phép kinh doanh (nếu có)

### Access Token hết hạn liên tục

**Giải pháp**:
1. Dùng Refresh Token thay vì Access Token
2. Implement auto-refresh trong code:

```typescript
async function getAccessToken() {
  const response = await fetch(
    'https://oauth.zaloapp.com/v4/oa/access_token',
    {
      method: 'POST',
      headers: { secret_key: process.env.ZALO_APP_SECRET! },
      body: new URLSearchParams({
        app_id: process.env.ZALO_APP_ID!,
        refresh_token: process.env.ZALO_REFRESH_TOKEN!,
        grant_type: 'refresh_token',
      }),
    }
  )
  const data = await response.json()
  return data.access_token
}
```

### Tin nhắn không gửi được

**Check theo thứ tự**:
1. Balance ZNS > 0
2. Template đã duyệt
3. Số điện thoại đúng format (84XXXXXXXXX)
4. Access token còn hạn
5. OA status = active

---

## 📞 Support

**Zalo Support**:
- Email: support@zalo.me
- Hotline: 1900 561 558
- Docs: https://zns.zalo.me/docs

**Zalo Developer Community**:
- Facebook Group: https://www.facebook.com/groups/zalodev
- Forum: https://developers.zalo.me/forum

---

**Last Updated**: 2025-01-16
**Status**: Ready for Implementation
