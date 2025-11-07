# Hướng dẫn cấu hình Zalo OAuth cho CPLS

Tài liệu này hướng dẫn chi tiết cách thiết lập đăng nhập qua Zalo cho ứng dụng CPLS.

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Đăng ký Zalo Developer Account](#1-đăng-ký-zalo-developer-account)
3. [Tạo Zalo App](#2-tạo-zalo-app)
4. [Cấu hình Supabase](#3-cấu-hình-supabase)
5. [Cấu hình biến môi trường](#4-cấu-hình-biến-môi-trường)
6. [Chạy migration database](#5-chạy-migration-database)
7. [Kiểm tra](#6-kiểm-tra)
8. [Xử lý lỗi phổ biến](#7-xử-lý-lỗi-phổ-biến)

---

## Tổng quan

Hệ thống xác thực Zalo của CPLS bao gồm:
- **Đăng nhập qua Zalo**: Người dùng có thể đăng nhập bằng tài khoản Zalo
- **Lưu trữ thông tin**: Tên, số điện thoại, ảnh đại diện từ Zalo
- **Phân quyền membership**: Free và Premium
- **Liên kết tài khoản**: Người dùng có thể liên kết Zalo với tài khoản email hiện có

---

## 1. Đăng ký Zalo Developer Account

### Bước 1.1: Truy cập Zalo Developers
1. Truy cập https://developers.zalo.me/
2. Đăng nhập bằng tài khoản Zalo của bạn
3. Chấp nhận điều khoản sử dụng

### Bước 1.2: Xác thực tài khoản
1. Vào mục "Quản lý tài khoản"
2. Hoàn thành xác thực thông tin (CMND/CCCD nếu cần)
3. Chờ Zalo phê duyệt (thường trong 1-2 ngày làm việc)

---

## 2. Tạo Zalo App

### Bước 2.1: Tạo App mới
1. Vào **"Ứng dụng của tôi"** (My Apps)
2. Click **"Tạo ứng dụng mới"** (Create New App)
3. Điền thông tin:
   - **Tên ứng dụng**: CPLS - Master Trading Platform
   - **Loại ứng dụng**: Web Application
   - **Mô tả**: Nền tảng phân tích và tín hiệu chứng khoán
   - **Website**: URL production của bạn (vd: https://cpls.yourdomain.com)

### Bước 2.2: Lấy thông tin App
Sau khi tạo xong, lưu lại:
- **App ID**: Dùng cho `NEXT_PUBLIC_ZALO_APP_ID`
- **App Secret**: Dùng cho `ZALO_APP_SECRET`

### Bước 2.3: Cấu hình OAuth Settings
1. Vào mục **"Cài đặt"** (Settings) của app
2. Chọn tab **"OAuth Settings"**
3. Thêm **Redirect URIs**:
   ```
   http://localhost:3000/auth/callback (cho development)
   https://yourdomain.com/auth/callback (cho production)
   https://your-project.supabase.co/auth/v1/callback (cho Supabase)
   ```

### Bước 2.4: Cấu hình quyền truy cập (Scopes)
Bật các quyền sau trong phần **"Permissions"**:
- ✅ **id**: Lấy ID người dùng
- ✅ **name**: Lấy tên người dùng
- ✅ **picture**: Lấy ảnh đại diện
- ✅ **phone**: Lấy số điện thoại (cần xin phép đặc biệt)

> **Lưu ý**: Quyền `phone` cần gửi yêu cầu đến Zalo và chờ phê duyệt.

---

## 3. Cấu hình Supabase

### Option 1: Sử dụng Custom OAuth Provider

Vì Supabase chưa hỗ trợ Zalo OAuth sẵn, bạn cần cấu hình custom provider hoặc sử dụng Supabase Edge Functions.

#### Bước 3.1: Tạo Supabase Edge Function

Tạo file `supabase/functions/zalo-auth/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = await req.json()

    // Exchange code for access token with Zalo
    const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        app_id: Deno.env.get('ZALO_APP_ID') || '',
        app_secret: Deno.env.get('ZALO_APP_SECRET') || '',
        code,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Get user info from Zalo
    const userResponse = await fetch(`https://graph.zalo.me/v2.0/me?access_token=${accessToken}&fields=id,name,picture`)
    const userData = await userResponse.json()

    // Create or update user in Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseClient.auth.admin.createUser({
      email: `zalo_${userData.id}@zalo.cpls.app`, // Pseudo email
      email_confirm: true,
      user_metadata: {
        full_name: userData.name,
        avatar_url: userData.picture?.data?.url,
        provider: 'zalo',
        provider_id: userData.id,
      },
    })

    return new Response(
      JSON.stringify({ user: data.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

#### Bước 3.2: Deploy Edge Function

```bash
# Login to Supabase
npx supabase login

# Deploy function
npx supabase functions deploy zalo-auth --no-verify-jwt

# Set environment variables
npx supabase secrets set ZALO_APP_ID=your_app_id
npx supabase secrets set ZALO_APP_SECRET=your_app_secret
```

### Option 2: Cấu hình qua Supabase Dashboard (Nếu hỗ trợ Custom Provider)

1. Vào **Supabase Dashboard** > **Authentication** > **Providers**
2. Chọn **"Add Provider"** hoặc **"Configure Custom Provider"**
3. Nhập thông tin:
   - **Provider Name**: zalo
   - **Client ID**: [Zalo App ID]
   - **Client Secret**: [Zalo App Secret]
   - **Authorization URL**: `https://oauth.zaloapp.com/v4/permission`
   - **Token URL**: `https://oauth.zaloapp.com/v4/access_token`
   - **User Info URL**: `https://graph.zalo.me/v2.0/me`

---

## 4. Cấu hình biến môi trường

Tạo file `.env.local` từ template:

```bash
cp .env.local.example .env.local
```

Cập nhật các biến sau trong `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Gemini AI API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Zalo OAuth Configuration
NEXT_PUBLIC_ZALO_APP_ID=your_zalo_app_id_here
ZALO_APP_SECRET=your_zalo_app_secret_here
```

---

## 5. Chạy migration database

### Bước 5.1: Chạy migration qua Supabase SQL Editor

1. Vào **Supabase Dashboard** > **SQL Editor**
2. Mở file `migrations/001_add_user_fields_and_zalo.sql`
3. Copy toàn bộ nội dung và paste vào SQL Editor
4. Click **"Run"**

### Bước 5.2: Xác nhận migration thành công

Chạy query sau để kiểm tra:

```sql
-- Check if columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles';

-- Should show: full_name, phone_number, stock_account_number,
-- avatar_url, zalo_id, membership, membership_expires_at
```

---

## 6. Kiểm tra

### Bước 6.1: Chạy development server

```bash
npm run dev
```

### Bước 6.2: Test đăng nhập

1. Truy cập http://localhost:3000
2. Click nút **"Đăng nhập với Zalo"**
3. Đăng nhập Zalo và chấp nhận quyền
4. Xác nhận redirect về `/auth/callback`
5. Kiểm tra profile tại `/profile`

### Bước 6.3: Xác nhận dữ liệu trong Supabase

Vào **Supabase Dashboard** > **Table Editor** > **profiles**:
- Kiểm tra có user mới với `zalo_id` được điền
- Xác nhận `full_name`, `avatar_url` được lưu
- Kiểm tra `membership` mặc định là `free`

---

## 7. Xử lý lỗi phổ biến

### Lỗi: "Invalid redirect URI"

**Nguyên nhân**: Redirect URI không khớp với Zalo App settings

**Giải pháp**:
1. Vào Zalo Developers > App Settings > OAuth Settings
2. Thêm đúng URL: `http://localhost:3000/auth/callback`
3. Đảm bảo không có khoảng trắng hoặc ký tự thừa

### Lỗi: "App not approved for phone permission"

**Nguyên nhân**: Chưa được Zalo phê duyệt quyền lấy số điện thoại

**Giải pháp**:
1. Gửi yêu cầu phê duyệt trong Zalo Developers > Permissions
2. Hoặc loại bỏ scope `phone` khỏi request
3. Cho phép người dùng nhập số điện thoại thủ công trong trang Profile

### Lỗi: "CORS policy blocked"

**Nguyên nhân**: Supabase chặn request từ origin không được phép

**Giải pháp**:
1. Vào Supabase Dashboard > Settings > API
2. Thêm domain của bạn vào **"Allowed Origins"**
3. Thêm `http://localhost:3000` cho development

### Lỗi: "User already exists"

**Nguyên nhân**: Zalo ID đã được đăng ký

**Giải pháp**:
- Đây là hành vi bình thường, user sẽ được đăng nhập vào tài khoản hiện có
- Kiểm tra logic trong `auth/callback/page.tsx` để handle trường hợp này

### Lỗi: "Failed to create profile"

**Nguyên nhân**: RLS (Row Level Security) chặn insert

**Giải pháp**:
1. Kiểm tra RLS policies trong Supabase
2. Chạy lại migration để tạo policies:
   ```sql
   -- Enable RLS
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   -- Allow insert own profile
   CREATE POLICY "Users can insert own profile"
     ON profiles FOR INSERT
     WITH CHECK (auth.uid() = id);
   ```

---

## 8. Tính năng đã triển khai

✅ Đăng nhập qua Zalo OAuth
✅ Tạo profile tự động từ thông tin Zalo
✅ Lưu trữ: tên, ảnh đại diện, số điện thoại, email
✅ Liên kết Zalo với tài khoản hiện có
✅ Trang quản lý profile (`/profile`)
✅ Phân quyền membership: Free / Premium
✅ Kiểm tra hết hạn Premium membership
✅ Trang callback xử lý OAuth redirect
✅ UI button đăng nhập Zalo trong AuthForm
✅ Backward compatibility với hệ thống cũ (user/vip)

---

## 9. API Reference

### Auth Service Methods

```typescript
// Đăng nhập với Zalo
authService.signInWithZalo(options?: ZaloAuthOptions)

// Lấy thông tin user metadata (bao gồm OAuth data)
authService.getUserMetadata()

// Xử lý OAuth callback
authService.handleOAuthCallback()
```

### Profile Service Methods

```typescript
// Cập nhật profile
profileService.updateProfile(userId, updates)

// Liên kết Zalo account
profileService.linkZaloAccount(userId, zaloId, zaloData?)

// Lấy profile theo Zalo ID
profileService.getProfileByZaloId(zaloId)

// Kiểm tra Premium membership
profileService.isPremium(userId)

// Cập nhật membership
profileService.updateMembership(userId, membership, expiresAt?)
```

---

## 10. Bảo mật

### Best Practices

1. **Không bao giờ** lưu `ZALO_APP_SECRET` trong client-side code
2. **Luôn validate** OAuth state parameter để chống CSRF
3. **Sử dụng HTTPS** trong production
4. **Giới hạn** redirect URIs trong Zalo App settings
5. **Enable RLS** trong Supabase để bảo vệ dữ liệu
6. **Kiểm tra** membership expiration trước khi cho phép truy cập Premium features

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_ZALO_APP_ID` | Client | Public, dùng để khởi tạo OAuth flow |
| `ZALO_APP_SECRET` | Server | Secret, dùng để exchange authorization code |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Public, Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Public, Supabase anon key (limited permissions) |

---

## 11. Hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra logs trong Supabase Dashboard > Logs
2. Kiểm tra browser console cho lỗi client-side
3. Xem Zalo Developers > App Logs
4. Tham khảo:
   - [Zalo OAuth Documentation](https://developers.zalo.me/docs/api/social-api/tai-lieu)
   - [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

---

## 12. Next Steps

Sau khi cấu hình xong, bạn có thể:
- [ ] Thêm các provider OAuth khác (Google, Facebook)
- [ ] Tích hợp payment gateway để nâng cấp Premium
- [ ] Thêm email notifications cho membership expiration
- [ ] Xây dựng admin dashboard để quản lý users
- [ ] Tạo webhook để sync với Zalo khi user thay đổi thông tin

---

**Chúc bạn triển khai thành công! 🎉**
