# 📱 Phone + OTP Authentication Implementation Guide

## 📋 Overview

This document describes the complete implementation of phone number + OTP authentication system using Zalo ZNS, replacing the previous Zalo OAuth system.

**Status**: ✅ **COMPLETE - Ready for deployment**

---

## 🎯 What Changed

### Removed ❌

1. **Zalo OAuth Login**
   - ZaloLoginButton component
   - OAuth API routes (`/api/auth/zalo/*`)
   - OAuth callback handler (`/auth/callback`)
   - All Zalo OAuth documentation

2. **Test Pages**
   - `/test-zalo-config`
   - `/test-zalo-debug`

3. **Scripts**
   - Zalo password migration scripts
   - Zalo field verification scripts

### Added ✅

1. **Phone + OTP Authentication**
   - PhoneInput component
   - OTPInput component
   - PhoneAuthForm component (replaces ZaloLoginButton)
   - OTP API endpoints (`/api/auth/phone/*`)

2. **Database Schema**
   - `otp_verifications` table
   - `otp_rate_limits` table
   - Rate limiting functions
   - RLS policies

3. **Documentation**
   - Zalo ZNS setup guide
   - Phone authentication architecture
   - This implementation guide

---

## 🗂️ File Structure

```
CPLS/
├── app/
│   └── api/
│       └── auth/
│           └── phone/
│               ├── send-otp/
│               │   └── route.ts          # Send OTP endpoint
│               └── verify-otp/
│                   └── route.ts          # Verify OTP endpoint
├── components/
│   ├── AuthForm.tsx                      # ✨ Updated to use PhoneAuthForm
│   ├── PhoneAuthForm.tsx                 # ✨ New - Main auth form
│   ├── PhoneInput.tsx                    # ✨ New - Phone input component
│   └── OTPInput.tsx                      # ✨ New - OTP input component
├── migrations/
│   └── 003_add_otp_verification.sql     # ✨ New - OTP database schema
└── docs/
    ├── PHONE_OTP_AUTH_ARCHITECTURE.md   # Architecture design
    ├── ZALO_ZNS_SETUP_GUIDE.md          # ZNS setup instructions
    └── PHONE_OTP_IMPLEMENTATION.md      # This file
```

---

## 🚀 Deployment Steps

### Step 1: Database Migration

Run the migration in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy and paste the content from `migrations/003_add_otp_verification.sql`
4. Click "Run"
5. Verify success message

**What this creates**:
- `otp_verifications` table (stores OTP codes)
- `otp_rate_limits` table (prevents abuse)
- Helper functions (`check_rate_limit`, `delete_expired_otps`, etc.)
- RLS policies for security
- Indexes for performance

### Step 2: Zalo ZNS Setup

Follow the complete guide in `docs/ZALO_ZNS_SETUP_GUIDE.md`.

**Quick summary**:
1. Register Zalo Official Account (OA) at https://oa.zalo.me/
2. Activate ZNS service at https://zns.zalo.me/
3. Create OTP template and get it approved
4. Obtain credentials:
   - OA ID
   - App ID
   - App Secret
   - Refresh Token
   - Template ID

### Step 3: Environment Variables

Add to `.env.local` (development) and Vercel (production):

```bash
# Zalo ZNS Configuration
ZALO_OA_ID=your_oa_id_here
ZALO_APP_ID=your_app_id_here
ZALO_APP_SECRET=your_app_secret_here
ZALO_REFRESH_TOKEN=your_refresh_token_here
ZALO_ZNS_TEMPLATE_ID=your_template_id_here

# Supabase (should already exist)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**In Vercel**:
1. Go to Project Settings → Environment Variables
2. Add all variables above
3. Redeploy the project

### Step 4: Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "feat: Implement phone + OTP authentication with Zalo ZNS"

# Push to repository
git push origin claude/zalo-auth-integration-011wHm28n9ee6EZU4rqYToMN

# Deploy will trigger automatically
```

Or deploy manually:

```bash
vercel --prod
```

---

## 🧪 Testing

### Test in Mock Mode (No Zalo ZNS credentials needed)

If you haven't configured Zalo ZNS yet, the system runs in **mock mode**:

1. Start development server:
   ```bash
   npm run dev
   ```

2. Go to http://localhost:3000/login

3. Enter a phone number (e.g., `0901234567`)

4. Click "Tiếp tục"

5. **Check the server console** - you'll see:
   ```
   ==================================================
   🧪 MOCK MODE: Zalo ZNS
   ==================================================
   Phone: 84901234567
   OTP Code: 123456
   Expires: 5 minutes
   ==================================================
   ```

6. Enter the OTP code shown in console

7. You should be logged in!

### Test with Real Zalo ZNS

1. Complete Zalo ZNS setup (Steps 2-3 above)

2. Configure environment variables

3. Restart server:
   ```bash
   npm run dev
   ```

4. Enter your real phone number

5. Check your Zalo app for the OTP message

6. Enter OTP and verify

---

## 📊 API Endpoints

### POST `/api/auth/phone/send-otp`

Send OTP to a phone number.

**Request**:
```json
{
  "phone": "0901234567",
  "purpose": "login"  // or "registration"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Mã OTP đã được gửi đến Zalo của bạn",
  "expiresIn": 300
}
```

**Response (Mock Mode)**:
```json
{
  "success": true,
  "message": "🧪 MOCK MODE: Mã OTP của bạn là 123456 (check console logs)",
  "expiresIn": 300,
  "mockMode": true
}
```

**Error Responses**:
- `400` - Invalid phone number
- `404` - Phone not registered (for login)
- `409` - Phone already registered (for registration)
- `429` - Rate limit exceeded
- `500` - Server error

### POST `/api/auth/phone/verify-otp`

Verify OTP and create/login user.

**Request**:
```json
{
  "phone": "0901234567",
  "otp": "123456"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "phone": "84901234567",
    "email": "phone_84901234567@cpls.app"
  },
  "session": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1234567890
  }
}
```

**Error Responses**:
- `400` - Invalid OTP, expired, or wrong format
- `500` - Server error

---

## 🔒 Security Features

### Rate Limiting

Implemented at database level using `check_rate_limit()` function:

- **Phone number**: Max 3 OTP requests per hour
- **IP address**: Max 10 OTP requests per hour
- **Lockout**: 1 hour after exceeding limit

### OTP Security

- **Length**: 6 digits (100,000 - 999,999)
- **Expiration**: 5 minutes
- **Max attempts**: 3 attempts per OTP
- **Auto-invalidation**: Old OTPs automatically invalidated when new one is requested

### Database Security

- **Row Level Security (RLS)**: Enabled on all tables
- **Policies**:
  - Users can only see their own OTP records
  - Users can only update their own verifications
  - Rate limits are readable by all (for checking)

### Password Generation

For users created via phone auth:

```typescript
password = `phone_${phoneNumber}_${random}_cpls_2025`
```

- Unique per phone number
- Contains random component
- Never exposed to user (auto-generated)

---

## 💰 Cost Estimation

### Zalo ZNS Pricing

- **Cost per OTP**: ~200-300 VND (~$0.01 USD)
- **Minimum top-up**: 100,000 VND (~$4 USD)
- **SMS fallback**: ~500-700 VND if ZNS fails

### Monthly Cost Examples

| Users/Month | OTP Requests | Cost (VND) | Cost (USD) |
|-------------|--------------|------------|------------|
| 100         | 100          | 30,000     | $1.20      |
| 500         | 500          | 150,000    | $6.00      |
| 1,000       | 1,000        | 300,000    | $12.00     |
| 5,000       | 5,000        | 1,500,000  | $60.00     |
| 10,000      | 10,000       | 3,000,000  | $120.00    |

**Note**: Actual costs depend on:
- Resend rate (users requesting OTP multiple times)
- Failed attempts (typos, expired codes)
- SMS fallback usage

**Comparison with Twilio**:
- Twilio SMS: $0.05 per message
- Zalo ZNS: $0.01 per message
- **Savings**: 80% cheaper with Zalo ZNS 🎉

---

## 🎨 UI/UX Features

### PhoneInput Component

- ✅ Auto-formatting (0901 234 567 or 84 901 234 567)
- ✅ Country code indicator (VN / +84)
- ✅ Clear button
- ✅ Input validation
- ✅ Error messages
- ✅ Focus states with animations

### OTPInput Component

- ✅ 6 separate input boxes
- ✅ Auto-focus next input
- ✅ Auto-submit when complete
- ✅ Paste support (copy full OTP)
- ✅ Backspace navigation
- ✅ Progress indicator
- ✅ Keyboard shortcuts (Arrow keys)

### PhoneAuthForm Component

- ✅ Two-step flow (phone → OTP)
- ✅ Countdown timer (60s) for resend
- ✅ Loading states
- ✅ Error handling
- ✅ Success animations
- ✅ Mock mode indicator
- ✅ Back button to edit phone
- ✅ Toggle between registration/login

---

## 📱 User Flow

### Registration Flow

```
1. User opens login page
   ↓
2. Clicks "Đăng ký ngay" (toggle to registration)
   ↓
3. Enters phone number (e.g., 0901234567)
   ↓
4. Clicks "Tiếp tục"
   ↓
5. System validates:
   - Phone format ✓
   - Phone not already registered ✓
   - Rate limit not exceeded ✓
   ↓
6. OTP sent to Zalo
   ↓
7. User enters 6-digit OTP
   ↓
8. System verifies:
   - OTP matches ✓
   - Not expired ✓
   - Within attempt limit ✓
   ↓
9. Create Supabase user + profile
   ↓
10. Auto-login and redirect to dashboard
```

### Login Flow

```
1. User opens login page
   ↓
2. Enters phone number
   ↓
3. Clicks "Tiếp tục"
   ↓
4. System validates:
   - Phone format ✓
   - Phone is registered ✓
   - Rate limit not exceeded ✓
   ↓
5. OTP sent to Zalo
   ↓
6. User enters OTP
   ↓
7. System verifies OTP
   ↓
8. Sign in to Supabase
   ↓
9. Redirect to dashboard
```

---

## 🐛 Troubleshooting

### Issue: "Mock mode" message appears

**Cause**: Zalo ZNS environment variables not configured

**Fix**:
1. Check `.env.local` has all required variables
2. Restart development server
3. Verify variables in Vercel dashboard (for production)

### Issue: OTP not received on Zalo

**Possible causes**:
1. Template not approved yet
2. Access token expired
3. Phone number format wrong (must be 84XXXXXXXXX)
4. ZNS balance is 0

**Fix**:
1. Check Zalo ZNS dashboard for template status
2. Refresh access token (happens automatically)
3. Use phone numbers starting with 84 (not 0)
4. Top up ZNS balance

### Issue: "Rate limit exceeded"

**Cause**: Too many OTP requests from same phone or IP

**Fix**:
- Wait 1 hour before trying again
- OR manually reset in database:
  ```sql
  DELETE FROM otp_rate_limits
  WHERE identifier = '84901234567';
  ```

### Issue: "OTP expired"

**Cause**: OTP only valid for 5 minutes

**Fix**:
- Click "Gửi lại mã OTP" to get new code
- Enter new code within 5 minutes

### Issue: Database error when creating OTP

**Cause**: Migration not run

**Fix**:
1. Go to Supabase SQL Editor
2. Run `migrations/003_add_otp_verification.sql`
3. Verify tables created:
   ```sql
   SELECT * FROM otp_verifications LIMIT 1;
   SELECT * FROM otp_rate_limits LIMIT 1;
   ```

---

## 📊 Monitoring & Maintenance

### View OTP Statistics

```sql
-- Check OTP success rate
SELECT * FROM otp_statistics
ORDER BY date DESC
LIMIT 30;

-- See recent OTP requests
SELECT
  phone_number,
  purpose,
  verified,
  attempts,
  created_at,
  expires_at
FROM otp_verifications
ORDER BY created_at DESC
LIMIT 20;

-- Check rate limits
SELECT
  identifier,
  identifier_type,
  request_count,
  locked_until
FROM otp_rate_limits
WHERE window_start > NOW() - INTERVAL '1 day'
ORDER BY request_count DESC;
```

### Cleanup Old Data

Run periodically (e.g., daily cron job):

```sql
SELECT cleanup_old_otp_data();
```

This removes:
- OTP records older than 24 hours
- Expired rate limit windows

### Monitor Costs

1. Check ZNS dashboard daily
2. Set up balance alerts (< 50,000 VND)
3. Track OTP success rate
4. Identify patterns (high resend rate = UX issue)

---

## 🔄 Future Improvements

### Potential Enhancements

1. **SMS Fallback**
   - If Zalo ZNS fails, fallback to Twilio SMS
   - Requires Twilio account

2. **Biometric Login**
   - After first OTP login, enable Face ID / Touch ID
   - Reduces OTP requests

3. **Remember Device**
   - Option to skip OTP for 30 days on trusted device
   - Store device fingerprint

4. **Multiple Phone Numbers**
   - Allow users to add backup phone numbers
   - Choose which one to use for OTP

5. **Voice OTP**
   - For users who don't use Zalo
   - Call phone number and speak OTP

6. **Analytics Dashboard**
   - Track OTP success rate
   - Monitor costs
   - Identify issues

---

## 📞 Support

### For Zalo ZNS Issues

- Email: support@zalo.me
- Hotline: 1900 561 558
- Docs: https://zns.zalo.me/docs

### For Implementation Issues

Check documentation:
- `docs/PHONE_OTP_AUTH_ARCHITECTURE.md`
- `docs/ZALO_ZNS_SETUP_GUIDE.md`
- `docs/PHONE_OTP_IMPLEMENTATION.md` (this file)

---

## ✅ Deployment Checklist

Before going to production:

- [ ] Database migration completed (`003_add_otp_verification.sql`)
- [ ] Zalo Official Account approved
- [ ] ZNS service activated
- [ ] ZNS balance topped up (min 100,000 VND)
- [ ] OTP template approved
- [ ] Environment variables configured in Vercel
- [ ] Tested in mock mode locally
- [ ] Tested with real phone number
- [ ] Rate limiting verified
- [ ] OTP expiration verified (5 minutes)
- [ ] User flow tested (registration + login)
- [ ] Error handling tested
- [ ] Mobile responsive design verified
- [ ] Analytics/monitoring set up

---

**Last Updated**: 2025-01-16
**Status**: ✅ Complete - Ready for Production
**Version**: 1.0.0
