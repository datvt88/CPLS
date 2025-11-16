-- ============================================================================
-- COMPLETE ZALO OAUTH MIGRATION SCRIPT
-- ============================================================================
-- Script này bao gồm TẤT CẢ migrations cần thiết cho Zalo OAuth integration
-- Chạy script này trong Supabase SQL Editor (1 lần duy nhất)
--
-- Includes:
-- 1. Add user profile fields (full_name, phone_number, avatar_url, etc.)
-- 2. Add Zalo integration fields (zalo_id, birthday, gender)
-- 3. Migrate role -> membership
-- 4. Create indexes
-- 5. Setup RLS policies
-- 6. Create auto-update trigger
--
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- ============================================================================
-- PART 1: ADD BASIC USER PROFILE FIELDS
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stock_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- PART 2: ADD ZALO OAUTH FIELDS
-- ============================================================================

-- Zalo ID (unique identifier from Zalo)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zalo_id TEXT UNIQUE;

-- Birthday from Zalo (format: DD/MM/YYYY)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday TEXT;

-- Gender from Zalo (values: "male", "female", or null)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add gender constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_gender_check
      CHECK (gender IN ('male', 'female'));
  END IF;
END $$;

-- ============================================================================
-- PART 3: ADD MEMBERSHIP SYSTEM (REPLACING OLD ROLE SYSTEM)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;

-- Add membership constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_membership_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_membership_check
      CHECK (membership IN ('free', 'premium'));
  END IF;
END $$;

-- Migrate existing role data to membership (if role column exists)
-- 'user' -> 'free', 'vip' -> 'premium'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    -- Migrate data
    UPDATE profiles SET membership =
      CASE
        WHEN role = 'vip' THEN 'premium'
        ELSE 'free'
      END
    WHERE membership IS NULL OR membership = 'free';

    -- Drop old role column after migration
    ALTER TABLE profiles DROP COLUMN IF EXISTS role;

    RAISE NOTICE '✓ Migrated role -> membership (user->free, vip->premium)';
  ELSE
    RAISE NOTICE 'ℹ No role column found - skipping migration';
  END IF;
END $$;

-- ============================================================================
-- PART 4: ADD TCBS INTEGRATION FIELDS (IF NEEDED)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tcbs_api_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tcbs_connected_at TIMESTAMPTZ;

-- ============================================================================
-- PART 5: CREATE INDEXES FOR BETTER PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON profiles(membership);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname);

-- ============================================================================
-- PART 6: CREATE AUTO-UPDATE TRIGGER FOR updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 7: SETUP ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Allow profile creation during signup
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT INSERT ON profiles TO authenticated;

-- ============================================================================
-- PART 8: ADD CONSTRAINTS (OPTIONAL BUT RECOMMENDED)
-- ============================================================================

-- Nickname length constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nickname_length_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT nickname_length_check
      CHECK (nickname IS NULL OR (char_length(nickname) >= 2 AND char_length(nickname) <= 50));
  END IF;
END $$;

-- Phone number format constraint (basic validation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'phone_format_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT phone_format_check
      CHECK (phone_number IS NULL OR phone_number ~ '^[0-9+\-\s()]{9,20}$');
  END IF;
END $$;

-- ============================================================================
-- PART 9: VERIFICATION & SUCCESS MESSAGE
-- ============================================================================

DO $$
DECLARE
  column_count INTEGER;
  index_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Count added columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'profiles'
    AND column_name IN (
      'full_name', 'phone_number', 'nickname', 'stock_account_number',
      'avatar_url', 'zalo_id', 'birthday', 'gender',
      'membership', 'membership_expires_at', 'updated_at',
      'tcbs_api_key', 'tcbs_connected_at'
    );

  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'profiles'
    AND indexname LIKE 'idx_profiles_%';

  -- Count RLS policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'profiles';

  -- Success message
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '✅ ZALO OAUTH MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  ✓ Added % columns to profiles table', column_count;
  RAISE NOTICE '  ✓ Created % indexes for performance', index_count;
  RAISE NOTICE '  ✓ Setup % RLS policies for security', policy_count;
  RAISE NOTICE '  ✓ Created auto-update trigger for updated_at';
  RAISE NOTICE '  ✓ Migrated old role system to membership system';
  RAISE NOTICE '';
  RAISE NOTICE 'New fields:';
  RAISE NOTICE '  • full_name, phone_number, nickname';
  RAISE NOTICE '  • avatar_url, stock_account_number';
  RAISE NOTICE '  • zalo_id (UNIQUE)';
  RAISE NOTICE '  • birthday (DD/MM/YYYY format)';
  RAISE NOTICE '  • gender (male/female)';
  RAISE NOTICE '  • membership (free/premium)';
  RAISE NOTICE '  • updated_at (auto-updated)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Deploy your Next.js app with Zalo OAuth code';
  RAISE NOTICE '  2. Configure callback URL on Zalo Developer Console';
  RAISE NOTICE '  3. Test login with Zalo';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
END $$;
