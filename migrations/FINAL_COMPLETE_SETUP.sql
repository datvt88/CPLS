-- ============================================
-- CPLS - COMPLETE DATABASE SETUP SCRIPT
-- ============================================
-- Script này sẽ tự động kiểm tra và thêm tất cả những gì còn thiếu
-- AN TOÀN để chạy nhiều lần - không làm mất data
-- Copy toàn bộ script này vào Supabase SQL Editor và RUN
-- ============================================

-- ============================================
-- STEP 1: Add missing columns to profiles table
-- ============================================

DO $$
BEGIN
    -- Add role column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('user', 'mod', 'admin'));
        RAISE NOTICE '✅ Added column: role';
    ELSE
        RAISE NOTICE 'ℹ️  Column already exists: role';
    END IF;

    -- Add provider column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'provider'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN provider text DEFAULT 'email';
        RAISE NOTICE '✅ Added column: provider';
    ELSE
        RAISE NOTICE 'ℹ️  Column already exists: provider';
    END IF;

    -- Add provider_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'provider_id'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN provider_id text;
        RAISE NOTICE '✅ Added column: provider_id';
    ELSE
        RAISE NOTICE 'ℹ️  Column already exists: provider_id';
    END IF;

    -- Make phone_number nullable if not already
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'phone_number'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE profiles
        ALTER COLUMN phone_number DROP NOT NULL;
        RAISE NOTICE '✅ Made phone_number nullable';
    ELSE
        RAISE NOTICE 'ℹ️  phone_number is already nullable or does not exist';
    END IF;

END $$;

-- ============================================
-- STEP 2: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON profiles(membership);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- ============================================
-- STEP 3: Update trigger function for new users
-- ============================================

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
    phone_number,
    membership,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data->>'sub',
    NEW.raw_user_meta_data->>'phone_number',
    'free',
    'user',
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
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Create or replace trigger
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- STEP 5: Create helper function
-- ============================================

CREATE OR REPLACE FUNCTION is_admin_or_mod(user_id uuid)
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = user_id;

  RETURN user_role IN ('admin', 'mod');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 6: Enable RLS
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 7: Create RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Admins/Mods can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  USING (is_admin_or_mod(auth.uid()));

-- Policy: Admins/Mods can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id OR
    is_admin_or_mod(auth.uid())
  );

-- ============================================
-- STEP 8: Add comments to columns
-- ============================================

COMMENT ON COLUMN profiles.role IS 'User role: user (default), mod (moderator), admin (administrator)';
COMMENT ON COLUMN profiles.provider IS 'OAuth provider: google, zalo, email';
COMMENT ON COLUMN profiles.provider_id IS 'OAuth provider user ID';
COMMENT ON COLUMN profiles.membership IS 'Membership tier: free (default), premium';
COMMENT ON COLUMN profiles.membership_expires_at IS 'Premium membership expiry date (NULL = lifetime)';

-- ============================================
-- STEP 9: Verification
-- ============================================

-- Show success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ DATABASE SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
END $$;

-- Check columns
SELECT
    '📋 Columns verification:' AS info;

SELECT
  column_name,
  data_type,
  COALESCE(column_default, 'NULL') as default_value,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('role', 'provider', 'provider_id', 'membership', 'phone_number')
ORDER BY column_name;

-- Check indexes
SELECT
    '' AS separator,
    '🔍 Indexes verification:' AS info;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname LIKE 'idx_profiles_%'
ORDER BY indexname;

-- Check RLS policies
SELECT
    '' AS separator,
    '🔒 RLS Policies verification:' AS info;

SELECT
  policyname,
  cmd,
  CASE
    WHEN policyname LIKE '%Admin%' THEN '👑 Admin/Mod'
    ELSE '👤 User'
  END as who_can_use
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Show sample of existing users
SELECT
    '' AS separator,
    '👥 Sample of existing users:' AS info;

SELECT
  LEFT(id::text, 8) || '...' as user_id,
  email,
  COALESCE(full_name, 'N/A') as name,
  COALESCE(role, 'user') as role,
  membership,
  COALESCE(provider, 'email') as provider,
  created_at::date as joined_date
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- NEXT STEPS
-- ============================================

SELECT
    '' AS separator,
    '📝 NEXT STEPS:' AS title;

SELECT
    '1️⃣  Get your user ID:' AS step,
    'SELECT id, email FROM auth.users WHERE email = ''your-email@example.com'';' AS command;

SELECT
    '2️⃣  Make yourself admin:' AS step,
    'UPDATE profiles SET role = ''admin'' WHERE id = ''YOUR_USER_ID'';' AS command;

SELECT
    '3️⃣  (Optional) Grant premium:' AS step,
    'UPDATE profiles SET membership = ''premium'', membership_expires_at = NULL WHERE id = ''YOUR_USER_ID'';' AS command;

SELECT
    '4️⃣  Verify admin user:' AS step,
    'SELECT id, email, full_name, role, membership FROM profiles WHERE role = ''admin'';' AS command;

SELECT
    '5️⃣  Access admin panel:' AS step,
    'Logout, login again, then go to /management' AS command;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 All done! Your database is ready for admin management.';
    RAISE NOTICE '📖 Follow the NEXT STEPS above to create your first admin user.';
    RAISE NOTICE '';
END $$;
