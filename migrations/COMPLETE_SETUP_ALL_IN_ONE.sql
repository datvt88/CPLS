-- ============================================
-- CPLS - Complete Database Setup (All-in-One)
-- ============================================
-- This script sets up the entire database from scratch
-- Run this in Supabase SQL Editor if starting fresh

-- ============================================
-- 1. CREATE PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone_number text,  -- Made nullable for Google OAuth users
  full_name text,
  nickname text,  -- Display name (user can customize)
  stock_account_number text,  -- Optional stock account number
  avatar_url text,

  -- OAuth provider info
  provider text DEFAULT 'email',  -- 'google', 'zalo', 'email'
  provider_id text,  -- OAuth provider user ID

  -- Zalo specific fields
  zalo_id text,
  birthday text,  -- DD/MM/YYYY from Zalo
  gender text CHECK (gender IN ('male', 'female')),

  -- Membership and role
  membership text DEFAULT 'free' CHECK (membership IN ('free', 'premium')),
  membership_expires_at timestamptz,
  role text DEFAULT 'user' CHECK (role IN ('user', 'mod', 'admin')),

  -- TCBS integration
  tcbs_api_key text,
  tcbs_connected_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON profiles(membership);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- ============================================
-- 3. CREATE TRIGGER FUNCTION FOR NEW USERS
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
-- 4. CREATE TRIGGER ON AUTH.USERS
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 5. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to check if user is admin or mod
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
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. CREATE RLS POLICIES
-- ============================================

-- Drop existing policies if any
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
-- 8. ADD COMMENTS TO COLUMNS
-- ============================================

COMMENT ON COLUMN profiles.phone_number IS 'Phone number - nullable for Google OAuth users';
COMMENT ON COLUMN profiles.nickname IS 'User display name (customizable)';
COMMENT ON COLUMN profiles.provider IS 'OAuth provider: google, zalo, email';
COMMENT ON COLUMN profiles.provider_id IS 'OAuth provider user ID';
COMMENT ON COLUMN profiles.role IS 'User role: user (default), mod (moderator), admin (administrator)';
COMMENT ON COLUMN profiles.membership IS 'Membership tier: free (default), premium';
COMMENT ON COLUMN profiles.membership_expires_at IS 'Premium membership expiry date (NULL = lifetime)';

-- ============================================
-- 9. VERIFICATION QUERIES
-- ============================================

-- Check if table exists
SELECT 'profiles table exists' AS status
WHERE EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'profiles'
);

-- Check all columns
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'profiles';

-- Check triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_schema = 'auth';

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';

-- ============================================
-- 10. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================

-- Uncomment below to create a test admin user
-- Replace 'YOUR_USER_ID' with actual user ID from auth.users

/*
UPDATE profiles
SET role = 'admin',
    membership = 'premium',
    membership_expires_at = NULL  -- NULL = lifetime premium
WHERE id = 'YOUR_USER_ID';
*/

-- ============================================
-- SETUP COMPLETE!
-- ============================================

SELECT '✅ Database setup completed successfully!' AS message;
SELECT '📋 Next steps:' AS message;
SELECT '1. Create your first admin user by running:' AS message;
SELECT '   UPDATE profiles SET role = ''admin'' WHERE id = ''YOUR_USER_ID'';' AS message;
SELECT '2. Grant premium membership (optional):' AS message;
SELECT '   UPDATE profiles SET membership = ''premium'', membership_expires_at = NULL WHERE id = ''YOUR_USER_ID'';' AS message;
SELECT '3. Access admin panel at /management' AS message;
