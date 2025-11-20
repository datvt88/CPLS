# Google OAuth Setup Guide

Hướng dẫn cấu hình đăng nhập bằng Google Account với Supabase.

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Cấu hình Google Cloud Console](#cấu-hình-google-cloud-console)
3. [Cấu hình Supabase](#cấu-hình-supabase)
4. [Chạy Migration](#chạy-migration)
5. [Kiểm tra](#kiểm-tra)

---

## Tổng quan

Hệ thống đăng nhập hiện hỗ trợ:
- ✅ **Google OAuth** (đăng nhập bằng tài khoản Google)
- ✅ **Phone/Password** (đăng nhập bằng số điện thoại)
- ✅ **Zalo OAuth** (đăng nhập bằng Zalo - optional)

### Profile Fields

Khi user đăng nhập, profile sẽ tự động được tạo với các trường:

| Trường | Mô tả | Bắt buộc | Nguồn |
|--------|-------|----------|-------|
| `id` | UUID user | ✅ | Supabase Auth |
| `email` | Email | ✅ | Google/Phone Auth |
| `full_name` | Tên đầy đủ | ❌ | Google metadata |
| `nickname` | Tên hiển thị | ❌ | User tự đặt |
| `avatar_url` | URL avatar | ❌ | Google profile picture |
| `phone_number` | Số điện thoại | ❌ | Phone auth hoặc Google |
| `provider` | OAuth provider | ✅ | google/email/zalo |
| `provider_id` | Provider user ID | ❌ | Google sub |
| `membership` | Gói đăng ký | ✅ | Mặc định: `free` |
| `created_at` | Ngày tạo | ✅ | Auto |
| `updated_at` | Ngày cập nhật | ✅ | Auto |

---

## Cấu hình Google Cloud Console

### Bước 1: Tạo OAuth 2.0 Client

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện tại
3. Enable **Google+ API**:
   - Vào **APIs & Services** > **Library**
   - Tìm "Google+ API"
   - Click **Enable**

4. Tạo OAuth 2.0 credentials:
   - Vào **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Chọn **Application type**: Web application
   - **Name**: CPLS App (hoặc tên app của bạn)

### Bước 2: Cấu hình Authorized URLs

**Authorized JavaScript origins:**
```
http://localhost:3000
https://your-domain.com
https://<project-ref>.supabase.co
```

**Authorized redirect URIs:**
```
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
https://<project-ref>.supabase.co/auth/v1/callback
```

**⚠️ Quan trọng**: Thay `<project-ref>` bằng project reference của bạn trong Supabase.

### Bước 3: Lấy credentials

Sau khi tạo, bạn sẽ nhận được:
- **Client ID**: `xxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxx`

**Lưu lại để dùng ở bước tiếp theo!**

---

## Cấu hình Supabase

### Bước 1: Enable Google Provider

1. Truy cập [Supabase Dashboard](https://app.supabase.com/)
2. Chọn project của bạn
3. Vào **Authentication** > **Providers**
4. Tìm **Google** trong danh sách providers
5. Click để expand Google settings

### Bước 2: Nhập Google credentials

Nhập thông tin từ Google Cloud Console:

```
Google Client ID: [paste your client ID here]
Google Client Secret: [paste your client secret here]
```

### Bước 3: Cấu hình Redirect URL

Trong phần **Redirect URLs**, thêm:
```
https://your-domain.com/auth/callback
http://localhost:3000/auth/callback
```

### Bước 4: Enable Provider

- Toggle **Enable Sign in with Google** thành **ON**
- Click **Save**

---

## Chạy Migration

Migration `005_add_google_oauth_support.sql` đã được tạo sẵn trong thư mục `/migrations`.

### Cách 1: Chạy qua Supabase Dashboard (Recommended)

1. Truy cập Supabase Dashboard
2. Vào **SQL Editor**
3. Click **New query**
4. Copy nội dung file `migrations/005_add_google_oauth_support.sql`
5. Paste vào editor
6. Click **Run**

### Cách 2: Chạy qua Supabase CLI

```bash
# Install Supabase CLI (nếu chưa có)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref <your-project-ref>

# Run migration
supabase db push
```

### Migration sẽ thực hiện:

✅ Cho phép `phone_number` nullable (không bắt buộc cho Google login)
✅ Thêm trường `provider` để track authentication method
✅ Thêm trường `provider_id` để lưu Google user ID
✅ Tạo trigger tự động sync profile khi user đăng nhập
✅ Tạo indexes để tối ưu performance

---

## Kiểm tra

### Test Google Login Flow

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Mở trình duyệt:**
   - Truy cập `http://localhost:3000`
   - Click vào nút **"Đăng nhập bằng Google"**

3. **OAuth Flow:**
   - Bạn sẽ được redirect đến Google login page
   - Chọn tài khoản Google
   - Cho phép app truy cập thông tin
   - Redirect về `/auth/callback`
   - Auto redirect về dashboard

4. **Kiểm tra Profile:**
   - Vào Supabase Dashboard
   - **Table Editor** > **profiles**
   - Tìm user vừa đăng nhập
   - Kiểm tra các trường đã được tự động điền:
     - ✅ `email`
     - ✅ `full_name` (từ Google)
     - ✅ `avatar_url` (từ Google)
     - ✅ `provider` = `google`
     - ✅ `provider_id` (Google sub)
     - ✅ `membership` = `free`

### Test Profile Sync

Profile sẽ tự động được tạo/cập nhật khi:
- User đăng nhập lần đầu (INSERT)
- User đăng nhập lại (UPDATE nếu có thay đổi)
- User cập nhật profile trên Google (UPDATE khi login lại)

### Debug

Nếu có lỗi, kiểm tra browser console:

```javascript
// Xem auth state
const { data: { user } } = await supabase.auth.getUser()
console.log(user)

// Xem profile
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single()
console.log(profile)
```

---

## Troubleshooting

### Lỗi: "Invalid redirect URI"

**Nguyên nhân:** Redirect URI không match với config trong Google Cloud Console.

**Giải pháp:**
1. Kiểm tra URL trong browser khi lỗi xảy ra
2. Thêm URL đó vào **Authorized redirect URIs** trong Google Cloud Console
3. Thử lại

### Lỗi: "Access blocked: This app's request is invalid"

**Nguyên nhân:** Google+ API chưa được enable.

**Giải pháp:**
1. Vào Google Cloud Console
2. **APIs & Services** > **Library**
3. Enable **Google+ API**

### Profile không được tạo tự động

**Kiểm tra:**
1. Migration đã chạy thành công chưa?
2. Trigger `on_auth_user_created` đã tồn tại chưa?

**Kiểm tra trigger:**
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

**Chạy lại trigger nếu cần:**
```sql
-- Drop và recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### Provider luôn là "email" thay vì "google"

**Nguyên nhân:** Metadata không được sync đúng.

**Kiểm tra user metadata:**
```sql
SELECT
  id,
  email,
  raw_app_meta_data->>'provider' as provider,
  raw_user_meta_data
FROM auth.users
WHERE email = 'your-email@gmail.com';
```

---

## Tài liệu tham khảo

- [Supabase Auth - Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)

---

## Cập nhật

**Version:** 1.0
**Ngày tạo:** 2025-01-20
**Người tạo:** Claude AI
**Trạng thái:** ✅ Ready for production
