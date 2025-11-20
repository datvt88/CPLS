# 🚀 Quick Start: Enable Google OAuth trong Supabase

## ❌ Lỗi bạn đang gặp
```
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}
```

**Nguyên nhân:** Google OAuth provider chưa được bật trong Supabase.

---

## ✅ Giải pháp - 3 Bước

### **Bước 1: Tạo Google OAuth Credentials**

#### 1.1. Truy cập Google Cloud Console
Vào: https://console.cloud.google.com/

#### 1.2. Tạo hoặc chọn Project
- Click vào dropdown project ở top bar
- Tạo project mới hoặc chọn project hiện có

#### 1.3. Enable Google+ API
1. Vào **APIs & Services** > **Library**
2. Tìm kiếm "**Google+ API**"
3. Click **Enable**

#### 1.4. Tạo OAuth 2.0 Client ID
1. Vào **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Chọn **Application type**: **Web application**
4. **Name**: Đặt tên (ví dụ: "CPLS App")

#### 1.5. Configure OAuth Consent Screen (nếu chưa có)
Nếu bạn thấy thông báo "To create an OAuth client ID, you must first configure your consent screen":

1. Click **CONFIGURE CONSENT SCREEN**
2. Chọn **External** (cho phép bất kỳ ai đăng nhập)
3. Click **CREATE**
4. Điền thông tin cơ bản:
   - **App name**: CPLS (hoặc tên app của bạn)
   - **User support email**: Email của bạn
   - **Developer contact information**: Email của bạn
5. Click **SAVE AND CONTINUE**
6. Skip **Scopes** (click **SAVE AND CONTINUE**)
7. Skip **Test users** (click **SAVE AND CONTINUE**)
8. Click **BACK TO DASHBOARD**
9. Quay lại **Credentials** để tạo OAuth client ID

#### 1.6. Cấu hình Authorized redirect URIs

**⚠️ QUAN TRỌNG:** Bạn cần lấy **Supabase Project URL** trước.

**Lấy Supabase URL:**
1. Vào https://app.supabase.com/
2. Chọn project của bạn
3. Vào **Settings** > **API**
4. Copy **Project URL** (dạng: `https://xxxxx.supabase.co`)

**Thêm Redirect URIs:**

Trong phần **Authorized redirect URIs**, thêm 3 URLs sau:

```
https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
https://your-production-domain.com/auth/callback
```

**Thay thế:**
- `YOUR-PROJECT-REF` = Project reference của bạn (phần `xxxxx` trong URL Supabase)
- `your-production-domain.com` = Domain production của bạn (nếu có)

**Ví dụ:**
```
https://abcdefghijk.supabase.co/auth/v1/callback
http://localhost:3000/auth/callback
https://cpls.vercel.app/auth/callback
```

#### 1.7. Lưu và lấy Credentials

1. Click **CREATE**
2. Sẽ hiện popup với:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxx`
3. **COPY VÀ LƯU LẠI** cả 2 giá trị này!

---

### **Bước 2: Enable Google Provider trong Supabase**

#### 2.1. Truy cập Supabase Dashboard
Vào: https://app.supabase.com/

#### 2.2. Chọn Project
Click vào project của bạn

#### 2.3. Vào Authentication Settings
1. Sidebar bên trái: Click **Authentication**
2. Click tab **Providers**

#### 2.4. Enable Google Provider
1. Scroll xuống tìm **Google** trong danh sách providers
2. Click vào **Google** để expand
3. Toggle **Enable Sign in with Google** thành **ON** (màu xanh)

#### 2.5. Nhập Google Credentials
Dán thông tin từ Bước 1.7:

- **Client ID (for OAuth)**: Paste `xxxxx.apps.googleusercontent.com`
- **Client Secret (for OAuth)**: Paste `GOCSPX-xxxxx`

#### 2.6. Cấu hình Redirect URLs (Optional)
Trong phần **Redirect URLs**, có thể thêm:
```
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```

#### 2.7. Save
Click nút **Save** ở cuối trang

---

### **Bước 3: Chạy Database Migration**

Bạn cần chạy migration để cập nhật database schema hỗ trợ Google OAuth.

#### 3.1. Mở Supabase SQL Editor
1. Trong Supabase Dashboard, click **SQL Editor** (sidebar bên trái)
2. Click **New query**

#### 3.2. Copy Migration Code
Copy toàn bộ nội dung file: `migrations/005_add_google_oauth_support.sql`

Hoặc copy code dưới đây:

```sql
-- Migration: Add Google OAuth support
-- Update profiles table to support Google authentication

-- Make phone_number optional (nullable) for Google OAuth users
ALTER TABLE profiles
  ALTER COLUMN phone_number DROP NOT NULL;

-- Update phone_number constraint to allow empty/null
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS phone_format_check;

ALTER TABLE profiles
  ADD CONSTRAINT phone_format_check
  CHECK (phone_number IS NULL OR phone_number ~ '^[0-9+\-\s()]{9,20}$');

-- Add provider field to track authentication provider
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'email';

-- Add provider_id to track OAuth provider user ID
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provider_id text;

-- Update email constraint to allow it to be the unique identifier
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_email_key;

-- Make email unique again (for Google OAuth)
ALTER TABLE profiles
  ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Create index for provider lookup
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);
CREATE INDEX IF NOT EXISTS idx_profiles_provider_id ON profiles(provider_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.phone_number IS 'Phone number - required for phone auth, optional for Google OAuth';
COMMENT ON COLUMN profiles.provider IS 'Authentication provider: email, google, zalo, etc.';
COMMENT ON COLUMN profiles.provider_id IS 'OAuth provider user ID (e.g., Google sub)';

-- Function to auto-create/update profile on user signup/signin
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    provider,
    provider_id,
    membership,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data->>'sub',
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    provider = COALESCE(EXCLUDED.provider, profiles.provider),
    provider_id = COALESCE(EXCLUDED.provider_id, profiles.provider_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

#### 3.3. Run Migration
1. Paste code vào SQL Editor
2. Click **RUN** (hoặc Ctrl/Cmd + Enter)
3. Kiểm tra kết quả: "Success. No rows returned"

---

## ✅ Kiểm tra Setup thành công

### Test 1: Kiểm tra Provider đã bật
1. Supabase Dashboard > **Authentication** > **Providers**
2. **Google** phải có toggle màu **xanh** (ON)
3. Client ID và Secret đã được điền

### Test 2: Test đăng nhập
1. Khởi động app: `npm run dev`
2. Truy cập: `http://localhost:3000`
3. Click nút **"Đăng nhập bằng Google"**
4. Sẽ redirect đến trang đăng nhập Google (không lỗi nữa)

### Test 3: Kiểm tra profile sau đăng nhập
1. Đăng nhập thành công với Google
2. Vào Supabase Dashboard > **Table Editor** > **profiles**
3. Kiểm tra record mới có:
   - ✅ `email` - Email từ Google
   - ✅ `full_name` - Tên từ Google
   - ✅ `avatar_url` - Avatar từ Google
   - ✅ `provider` = `google`
   - ✅ `membership` = `free`

---

## 🔧 Troubleshooting

### Lỗi: "redirect_uri_mismatch"

**Nguyên nhân:** URL redirect không khớp với config trong Google Cloud.

**Giải pháp:**
1. Copy chính xác URL báo lỗi
2. Thêm URL đó vào **Authorized redirect URIs** trong Google Cloud Console
3. Thử lại sau 1-2 phút

### Lỗi: "Access blocked: This app's request is invalid"

**Nguyên nhân:** Google+ API chưa được enable.

**Giải pháp:**
1. Google Cloud Console > **APIs & Services** > **Library**
2. Tìm "Google+ API"
3. Click **Enable**

### Lỗi: "Unable to verify authorization state"

**Nguyên nhân:** Session hoặc cookies bị lỗi.

**Giải pháp:**
1. Clear cookies của localhost
2. Thử lại với incognito/private window

### Google provider vẫn báo "not enabled"

**Kiểm tra:**
1. Refresh lại trang Supabase Dashboard
2. Đợi 1-2 phút cho cache update
3. Kiểm tra lại tab Providers
4. Đảm bảo đã click **Save**

---

## 📝 Checklist

Đánh dấu các bước đã hoàn thành:

**Google Cloud Console:**
- [ ] Tạo/chọn project
- [ ] Enable Google+ API
- [ ] Tạo OAuth 2.0 Client ID
- [ ] Thêm Authorized redirect URIs
- [ ] Copy Client ID
- [ ] Copy Client Secret

**Supabase Dashboard:**
- [ ] Vào Authentication > Providers
- [ ] Toggle Google ON
- [ ] Paste Client ID
- [ ] Paste Client Secret
- [ ] Click Save
- [ ] Chạy migration SQL

**Testing:**
- [ ] Khởi động app
- [ ] Click "Đăng nhập bằng Google"
- [ ] Đăng nhập thành công
- [ ] Profile được tạo tự động
- [ ] Check database có data

---

## 🎯 Video Tutorial (Reference)

Nếu cần xem video hướng dẫn:
- [Supabase Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)

---

## 💡 Tips

1. **Development:** Dùng `http://localhost:3000` cho testing
2. **Production:** Nhớ thêm production domain vào Authorized URIs
3. **Multiple Domains:** Có thể thêm nhiều redirect URIs (dev, staging, prod)
4. **Security:** Không commit Client Secret vào Git

---

**Sau khi hoàn thành các bước trên, Google login sẽ hoạt động ngay lập tức!** ✨
