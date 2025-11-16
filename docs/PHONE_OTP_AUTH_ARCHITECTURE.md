# Phone + OTP Authentication Architecture

## Overview

Thay thế Zalo OAuth bằng hệ thống đăng ký/đăng nhập hiện đại với **số điện thoại + OTP** qua **Zalo ZNS**.

---

## 🎯 Authentication Flow

### Registration Flow (Đăng Ký)

```
1. User nhập số điện thoại (VD: 0901234567)
   ↓
2. Validate format số điện thoại
   ↓
3. Check số điện thoại đã tồn tại chưa
   ↓
4. Nếu chưa tồn tại:
   - Generate OTP (6 digits)
   - Lưu OTP vào database/cache (expire 5 phút)
   - Gửi OTP qua Zalo ZNS
   ↓
5. User nhập OTP
   ↓
6. Verify OTP
   ↓
7. Nếu đúng:
   - Tạo Supabase Auth user
   - Tạo profile với phone_number
   - Auto login
   - Redirect to dashboard
```

### Login Flow (Đăng Nhập)

```
1. User nhập số điện thoại
   ↓
2. Validate format
   ↓
3. Check số điện thoại có tồn tại không
   ↓
4. Nếu tồn tại:
   - Generate OTP (6 digits)
   - Lưu OTP vào database/cache
   - Gửi OTP qua Zalo ZNS
   ↓
5. User nhập OTP
   ↓
6. Verify OTP
   ↓
7. Nếu đúng:
   - Sign in to Supabase
   - Redirect to dashboard
```

---

## 📊 Database Schema

### Table: otp_verifications

```sql
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Index for fast lookup
CREATE INDEX idx_otp_phone ON otp_verifications(phone_number);
CREATE INDEX idx_otp_expires ON otp_verifications(expires_at);

-- Auto-delete expired OTPs
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_verifications
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

### Update profiles table

```sql
-- Phone number is primary identifier now
ALTER TABLE profiles
  ALTER COLUMN phone_number SET NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

-- Add unique constraint
CREATE UNIQUE INDEX idx_profiles_phone_unique ON profiles(phone_number);
```

---

## 🔌 Zalo ZNS Integration

### Requirements

1. **Zalo Official Account (OA)**
   - Đăng ký tại: https://oa.zalo.me/

2. **ZNS Template** (Phải được Zalo approve)
   ```
   Template Name: OTP_VERIFICATION
   Template Content:
   "Ma xac thuc cua ban la: {{otp_code}}.
   Ma co hieu luc trong {{expire_time}} phut.
   Vui long khong chia se ma nay voi bat ky ai."
   ```

3. **API Credentials**
   - OA ID
   - Access Token
   - App ID & Secret Key

### API Endpoints

**Send OTP via ZNS**:
```
POST https://business.openapi.zalo.me/message/template
Headers:
  access_token: <OA_ACCESS_TOKEN>

Body:
{
  "phone": "84901234567",  // Must include country code
  "template_id": "YOUR_TEMPLATE_ID",
  "template_data": {
    "otp_code": "123456",
    "expire_time": "5"
  }
}
```

---

## 🏗️ Implementation Plan

### Phase 1: Backend API

1. **POST /api/auth/phone/send-otp**
   - Validate phone number
   - Generate OTP
   - Save to database
   - Send via Zalo ZNS
   - Return success/error

2. **POST /api/auth/phone/verify-otp**
   - Validate OTP
   - Check expiration
   - Check attempts (max 3)
   - Create/login user
   - Return session

### Phase 2: Frontend UI

1. **PhoneAuthForm Component**
   - Phone number input
   - OTP input (appears after sending)
   - Loading states
   - Error handling
   - Countdown timer

2. **Replace AuthForm**
   - Remove email/password fields
   - Remove Zalo OAuth button
   - Add phone-based auth

### Phase 3: Cleanup

1. Remove Zalo OAuth files
2. Remove OAuth API routes
3. Update documentation

---

## 💰 Cost Estimation

**Zalo ZNS Pricing**:
- ~200-300 VND per successful message
- ~$0.01 USD per OTP
- For 1000 users/month: ~$10

**vs Twilio SMS**:
- ~$0.05 USD per SMS
- For 1000 users: ~$50

**→ Zalo ZNS is 5x cheaper!** 🎉

---

## 🔒 Security Features

1. **Rate Limiting**
   - Max 3 OTP requests per phone per hour
   - Max 3 verification attempts per OTP

2. **OTP Expiration**
   - Valid for 5 minutes only
   - Auto-delete after expiration

3. **Phone Validation**
   - Vietnam phone format only
   - Block VOIP numbers (optional)

4. **Brute Force Protection**
   - Lock account after 5 failed attempts
   - Require cooldown period

---

## 📱 User Experience

### Registration (First Time)

```
1. Welcome Screen
   "Đăng ký tài khoản CPLS"

2. Enter Phone
   [0] [9] [0] [1] [2] [3] [4] [5] [6] [7]
   [ Tiếp tục ]

3. Waiting for OTP
   "Đang gửi mã OTP đến 0901234567..."
   (Show spinner)

4. Enter OTP
   "Nhập mã OTP đã gửi đến Zalo của bạn"
   [_] [_] [_] [_] [_] [_]
   "Gửi lại (45s)"

5. Success
   "✅ Đăng ký thành công!"
   → Redirect to dashboard
```

### Login (Returning User)

```
1. Login Screen
   "Đăng nhập CPLS"

2. Enter Phone
   [0] [9] [0] [1] [2] [3] [4] [5] [6] [7]
   [ Đăng nhập ]

3. Enter OTP
   [_] [_] [_] [_] [_] [_]

4. Success
   → Redirect to dashboard
```

---

## 🎨 Modern UI Features

1. **Auto-focus** OTP inputs
2. **Auto-submit** when 6 digits entered
3. **Countdown timer** for resend
4. **Loading animations**
5. **Error messages** with retry
6. **Success animations**

---

## 📝 Next Steps

1. ✅ Setup Zalo Official Account
2. ✅ Create & approve ZNS template
3. ✅ Get API credentials
4. ✅ Implement backend APIs
5. ✅ Create frontend UI
6. ✅ Test flow
7. ✅ Deploy

---

**Last Updated**: 2025-01-16
**Status**: Design Complete, Ready to Implement
