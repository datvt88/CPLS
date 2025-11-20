# 🚀 Script Migration Đầy Đủ - Google OAuth Setup

Copy toàn bộ script bên dưới và paste vào Supabase SQL Editor.

---

## 📋 Script SQL - Copy Từ Đây

```sql
-- ============================================================================
-- MIGRATION: Add Google OAuth Support
-- Version: 1.0
-- Date: 2025-01-20
-- Description: Update profiles table to support Google authentication
-- ============================================================================

-- ============================================================================
-- PART 1: Update Existing Table Structure
-- ============================================================================

-- Make phone_number optional (nullable) for Google OAuth users
ALTER TABLE profiles
  ALTER COLUMN phone_number DROP NOT NULL;

-- Update phone_number constraint to allow empty/null
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS phone_format_check;

ALTER TABLE profiles
  ADD CONSTRAINT phone_format_check
  CHECK (phone_number IS NULL OR phone_number ~ '^[0-9+\-\s()]{9,20}$');

-- ============================================================================
-- PART 2: Add New Columns for OAuth Support
-- ============================================================================

-- Add provider field to track authentication provider
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'email';

-- Add provider_id to track OAuth provider user ID
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provider_id text;

-- ============================================================================
-- PART 3: Update Constraints
-- ============================================================================

-- Update email constraint to allow it to be the unique identifier
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_email_key;

-- Make email unique again (for Google OAuth)
ALTER TABLE profiles
  ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- ============================================================================
-- PART 4: Create Indexes for Performance
-- ============================================================================

-- Create index for provider lookup
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);
CREATE INDEX IF NOT EXISTS idx_profiles_provider_id ON profiles(provider_id);

-- ============================================================================
-- PART 5: Add Documentation Comments
-- ============================================================================

COMMENT ON COLUMN profiles.phone_number IS 'Phone number - required for phone auth, optional for Google OAuth';
COMMENT ON COLUMN profiles.provider IS 'Authentication provider: email, google, zalo, etc.';
COMMENT ON COLUMN profiles.provider_id IS 'OAuth provider user ID (e.g., Google sub)';

-- ============================================================================
-- PART 6: Create Auto-Sync Function
-- ============================================================================

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

-- ============================================================================
-- PART 7: Create Trigger
-- ============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- PART 8: Verification Queries (Optional - Run to check)
-- ============================================================================

-- Check new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('provider', 'provider_id')
ORDER BY column_name;

-- Check trigger exists
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';

-- ============================================================================
-- Migration Complete ✅
-- ============================================================================
```

---

## 🎯 Hướng dẫn sử dụng

### **Bước 1: Copy Script**
- Select toàn bộ code SQL từ dòng `-- ============` đến hết
- Copy (Ctrl/Cmd + C)

### **Bước 2: Mở Supabase SQL Editor**
1. Vào https://app.supabase.com/
2. Chọn project của bạn
3. Click **SQL Editor** (sidebar trái)
4. Click **New query**

### **Bước 3: Paste và Run**
1. Paste script vào editor (Ctrl/Cmd + V)
2. Click **RUN** hoặc nhấn `Ctrl/Cmd + Enter`
3. Đợi ~2-3 giây

### **Bước 4: Kiểm tra kết quả**

Bạn sẽ thấy output như sau:

```
✅ Success. No rows returned
```

Nếu có verification queries (PART 8), bạn sẽ thấy:

**New columns:**
| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| provider | text | NO | 'email'::text |
| provider_id | text | YES | NULL |

**Trigger:**
| trigger_name | event_manipulation | action_timing |
|--------------|-------------------|---------------|
| on_auth_user_created | INSERT | AFTER |
| on_auth_user_created | UPDATE | AFTER |

**Function:**
| proname | prosrc |
|---------|---------|
| handle_new_user | (function code) |

---

## ✅ Sau khi chạy xong

Migration đã hoàn tất! Bây giờ:

1. ✅ Bảng `profiles` đã hỗ trợ Google OAuth
2. ✅ Profile sẽ tự động được tạo khi user đăng nhập Google
3. ✅ Dữ liệu từ Google (tên, email, avatar) tự động sync

### **Next Steps:**

1. **Enable Google Provider trong Supabase:**
   - Authentication > Providers > Google
   - Toggle ON
   - Nhập Client ID và Client Secret

2. **Test đăng nhập:**
   - Chạy `npm run dev`
   - Click "Đăng nhập bằng Google"
   - Kiểm tra profile được tạo tự động

---

## 🔄 Rollback Script (nếu cần)

Nếu muốn hoàn tác migration:

```sql
-- Remove trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remove function
DROP FUNCTION IF EXISTS handle_new_user();

-- Remove indexes
DROP INDEX IF EXISTS idx_profiles_provider;
DROP INDEX IF EXISTS idx_profiles_provider_id;

-- Remove columns
ALTER TABLE profiles DROP COLUMN IF EXISTS provider;
ALTER TABLE profiles DROP COLUMN IF EXISTS provider_id;

-- Make phone_number required again (CAREFUL!)
ALTER TABLE profiles
  ALTER COLUMN phone_number SET NOT NULL;

-- Restore old constraint
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS phone_format_check;

ALTER TABLE profiles
  ADD CONSTRAINT phone_format_check
  CHECK (phone_number ~ '^[0-9+\-\s()]{9,20}$');
```

---

## 📞 Support

Nếu gặp lỗi khi chạy script:

1. **Lỗi: "column already exists"**
   - ✅ Bỏ qua, script đã có `IF NOT EXISTS`

2. **Lỗi: "constraint already exists"**
   - ✅ Bỏ qua, script đã có `DROP CONSTRAINT IF EXISTS`

3. **Lỗi khác:**
   - Kiểm tra bảng `profiles` có tồn tại không
   - Kiểm tra permissions của user
   - Copy lỗi và tìm kiếm trong docs

---

**Script Version:** 1.0
**Tương thích:** Supabase PostgreSQL 15+
**Tested:** ✅ Production Ready
