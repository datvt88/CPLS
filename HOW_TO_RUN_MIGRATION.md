# ⚠️ HƯỚNG DẪN CHẠY MIGRATION - ĐỌC KỸ

## ❌ Lỗi vừa gặp

```
ERROR: 42601: syntax error at or near "```"
```

**Nguyên nhân:** Bạn đã copy cả dấu markdown ```sql vào SQL Editor.

---

## ✅ Cách chạy ĐÚNG

### **Option 1: Copy từ file .sql (RECOMMENDED)**

1. **Mở file SQL:**
   ```
   migrations/005_add_google_oauth_support_READY_TO_COPY.sql
   ```

2. **Select ALL (Ctrl/Cmd + A)**

3. **Copy (Ctrl/Cmd + C)**

4. **Vào Supabase SQL Editor:**
   - https://app.supabase.com/
   - Chọn project → **SQL Editor**
   - Click **New query**

5. **Paste (Ctrl/Cmd + V)**

6. **RUN (Ctrl/Cmd + Enter)**

---

### **Option 2: Copy từ đây**

**⚠️ QUAN TRỌNG:** Copy từ dòng `-- ====` đến hết, **KHÔNG** copy dấu ``` ở đầu/cuối!

**BẮT ĐẦU COPY TỪ ĐÂY ↓**

```
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
-- PART 8: Verification Queries (Optional)
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
SELECT proname
FROM pg_proc
WHERE proname = 'handle_new_user';

-- ============================================================================
-- Migration Complete ✅
-- ============================================================================
```

**KẾT THÚC COPY TẠI ĐÂY ↑**

---

## 📸 Screenshot Hướng dẫn

### Bước 1: Supabase SQL Editor
![](https://supabase.com/docs/img/sql-editor.png)

### Bước 2: Paste code vào
- Đảm bảo **KHÔNG** có dấu ``` ở đầu
- Đảm bảo **KHÔNG** có dấu ``` ở cuối

### Bước 3: Click RUN
- Hoặc nhấn `Ctrl + Enter` (Windows/Linux)
- Hoặc nhấn `Cmd + Enter` (Mac)

---

## ✅ Kết quả thành công

Sau khi RUN, bạn sẽ thấy:

```
✅ Success. No rows returned
```

Hoặc nếu có verification queries (PART 8), sẽ thấy kết quả:

**Query 1: Check new columns**
| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| provider | text | NO | 'email'::text |
| provider_id | text | YES | NULL |

**Query 2: Check trigger**
| trigger_name | event_manipulation | action_timing |
|--------------|-------------------|---------------|
| on_auth_user_created | INSERT | AFTER |
| on_auth_user_created | UPDATE | AFTER |

**Query 3: Check function**
| proname |
|---------|
| handle_new_user |

---

## 🔧 Nếu vẫn gặp lỗi

### Lỗi: "column already exists"
✅ **Bỏ qua** - Columns đã được tạo, script sẽ skip

### Lỗi: "relation does not exist"
❌ **Nghiêm trọng** - Bảng `profiles` chưa tồn tại

**Giải pháp:** Chạy schema ban đầu trước:
```sql
-- Tạo bảng profiles nếu chưa có
CREATE TABLE IF NOT EXISTS profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  phone_number text not null,
  full_name text,
  nickname text,
  stock_account_number text,
  avatar_url text,
  zalo_id text unique,
  birthday text,
  gender text check (gender in ('male', 'female')),
  membership text default 'free' check (membership in ('free','premium')),
  membership_expires_at timestamptz,
  tcbs_api_key text,
  tcbs_connected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Sau đó chạy lại migration.

---

## 📁 Files tham khảo

| File | Mục đích |
|------|----------|
| `migrations/005_add_google_oauth_support_READY_TO_COPY.sql` | ✅ FILE NÀY - Copy trực tiếp |
| `migrations/005_add_google_oauth_support.sql` | File gốc (giống nhau) |
| `MIGRATION_SCRIPT_FULL.md` | Có markdown (đừng copy) |
| `HOW_TO_RUN_MIGRATION.md` | ⭐ File này - Hướng dẫn |

---

## 🎯 Checklist

- [ ] Mở file `migrations/005_add_google_oauth_support_READY_TO_COPY.sql`
- [ ] Select ALL (Ctrl/Cmd + A)
- [ ] Copy (Ctrl/Cmd + C)
- [ ] Vào Supabase Dashboard
- [ ] SQL Editor → New query
- [ ] Paste code (Ctrl/Cmd + V)
- [ ] Kiểm tra **KHÔNG** có dấu ``` ở đầu
- [ ] Click RUN
- [ ] Thấy "Success"
- [ ] ✅ Done!

---

**⚠️ LƯU Ý QUAN TRỌNG:**
- Đừng copy từ file `.md`
- Copy từ file `.sql` hoặc từ đây
- Đừng copy dấu ```
- Paste trực tiếp vào SQL Editor

---

**Sau khi migration thành công, tiếp tục:**
1. Enable Google Provider trong Supabase
2. Test đăng nhập với Google
3. Check profile tự động được tạo
