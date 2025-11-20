-- ============================================================================
-- COMPLETE SETUP: Create profiles table + Google OAuth support
-- Version: 1.0
-- Date: 2025-01-20
-- Description: Complete database setup from scratch
-- ============================================================================

-- ============================================================================
-- STEP 1: Create profiles table (if not exists)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone_number text,
  full_name text,
  nickname text,
  stock_account_number text,
  avatar_url text,
  zalo_id text unique,
  birthday text,
  gender text check (gender in ('male', 'female')),
  provider text default 'email',
  provider_id text,
  membership text default 'free' check (membership in ('free','premium')),
  membership_expires_at timestamptz,
  tcbs_api_key text,
  tcbs_connected_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Constraints
  constraint nickname_length_check check (nickname is null or (char_length(nickname) >= 2 and char_length(nickname) <= 50)),
  constraint phone_format_check check (phone_number is null or phone_number ~ '^[0-9+\-\s()]{9,20}$')
);

-- Make email unique
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);
CREATE INDEX IF NOT EXISTS idx_profiles_provider_id ON profiles(provider_id);

-- ============================================================================
-- STEP 3: Create update timestamp function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 4: Create auto-sync profile function (Google OAuth support)
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone_number,
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
    NEW.raw_user_meta_data->>'phone_number',
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
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    provider = COALESCE(EXCLUDED.provider, profiles.provider),
    provider_id = COALESCE(EXCLUDED.provider_id, profiles.provider_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: Create trigger for auto profile creation
-- ============================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 6: Add documentation comments
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profiles with support for multiple auth providers (Google, Phone, Zalo)';
COMMENT ON COLUMN profiles.id IS 'User ID from auth.users';
COMMENT ON COLUMN profiles.email IS 'User email - unique identifier';
COMMENT ON COLUMN profiles.phone_number IS 'Phone number - required for phone auth, optional for OAuth';
COMMENT ON COLUMN profiles.full_name IS 'Full name from OAuth provider or user input';
COMMENT ON COLUMN profiles.nickname IS 'Display name chosen by user';
COMMENT ON COLUMN profiles.avatar_url IS 'Profile picture URL from OAuth provider';
COMMENT ON COLUMN profiles.provider IS 'Authentication provider: email, google, zalo';
COMMENT ON COLUMN profiles.provider_id IS 'OAuth provider user ID (e.g., Google sub)';
COMMENT ON COLUMN profiles.membership IS 'Subscription level: free or premium';

-- ============================================================================
-- STEP 7: Create signals table (if needed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS signals (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  signal text check (signal in ('BUY','SELL','HOLD')),
  confidence numeric,
  created_at timestamptz default now()
);

-- ============================================================================
-- VERIFICATION: Check everything was created successfully
-- ============================================================================

-- Check profiles table
SELECT
  'profiles table' as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'profiles'
  ) THEN '✅ Created' ELSE '❌ Missing' END as status;

-- Check columns
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('id', 'email', 'phone_number', 'provider', 'provider_id', 'membership')
ORDER BY column_name;

-- Check indexes
SELECT
  indexname,
  tablename
FROM pg_indexes
WHERE tablename = 'profiles'
ORDER BY indexname;

-- Check triggers
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('on_auth_user_created', 'update_profiles_updated_at')
ORDER BY trigger_name;

-- Check functions
SELECT
  proname as function_name,
  'Created' as status
FROM pg_proc
WHERE proname IN ('handle_new_user', 'update_updated_at_column')
ORDER BY proname;

-- ============================================================================
-- Setup Complete! ✅
-- ============================================================================

-- Next steps:
-- 1. Enable Google Provider in Supabase Dashboard
-- 2. Add Google OAuth Client ID and Secret
-- 3. Test login with Google
-- 4. Profile will be auto-created on first login
