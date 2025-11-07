-- =====================================================
-- CPLS Database Migration
-- Version: 1.0
-- Date: 2025-01-07
-- Description: Add Zalo OAuth support and user profile fields
-- =====================================================

-- =====================================================
-- PART 1: PRE-MIGRATION CHECKS
-- =====================================================

-- Check if profiles table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    RAISE EXCEPTION 'Table "profiles" does not exist. Please create it first using schema.sql';
  END IF;
  RAISE NOTICE '✓ Table "profiles" exists';
END $$;

-- Display current schema
DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'profiles';

  RAISE NOTICE '✓ Current profiles table has % columns', col_count;
END $$;

-- =====================================================
-- PART 2: BACKUP EXISTING DATA (Optional safety check)
-- =====================================================

-- Count existing records
DO $$
DECLARE
  record_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO record_count FROM profiles;
  RAISE NOTICE '✓ Found % existing user records', record_count;
END $$;

-- =====================================================
-- PART 3: ADD NEW COLUMNS
-- =====================================================

-- Add user profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stock_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zalo_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add membership columns (replacing role)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;

-- Success notification for new columns
DO $$
BEGIN
  RAISE NOTICE '✓ Added new columns';
END $$;

-- =====================================================
-- PART 4: ADD CONSTRAINTS
-- =====================================================

-- Add unique constraint to zalo_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_zalo_id_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_zalo_id_key UNIQUE (zalo_id);
    RAISE NOTICE '✓ Added unique constraint on zalo_id';
  ELSE
    RAISE NOTICE '✓ Unique constraint on zalo_id already exists';
  END IF;
END $$;

-- Add check constraint for membership (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_membership_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_membership_check
      CHECK (membership IN ('free','premium'));
    RAISE NOTICE '✓ Added check constraint on membership';
  ELSE
    RAISE NOTICE '✓ Check constraint on membership already exists';
  END IF;
END $$;

-- =====================================================
-- PART 5: MIGRATE EXISTING DATA
-- =====================================================

-- Migrate role -> membership
DO $$
DECLARE
  migrated_count INTEGER := 0;
BEGIN
  -- Check if role column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    -- Update membership based on role
    UPDATE profiles SET membership =
      CASE
        WHEN role = 'vip' THEN 'premium'
        WHEN role = 'user' THEN 'free'
        ELSE 'free'
      END
    WHERE membership IS NULL OR membership = 'free';

    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    RAISE NOTICE '✓ Migrated % users from role to membership', migrated_count;

    -- Drop old role column
    ALTER TABLE profiles DROP COLUMN IF EXISTS role;
    RAISE NOTICE '✓ Removed old "role" column';
  ELSE
    RAISE NOTICE '✓ No "role" column to migrate';
  END IF;
END $$;

-- Set default membership for existing users without one
UPDATE profiles SET membership = 'free' WHERE membership IS NULL;

-- =====================================================
-- PART 6: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON profiles(membership);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Success notification for indexes
DO $$
BEGIN
  RAISE NOTICE '✓ Created performance indexes';
END $$;

-- =====================================================
-- PART 7: CREATE FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Success notification for triggers
DO $$
BEGIN
  RAISE NOTICE '✓ Created triggers for updated_at';
END $$;

-- =====================================================
-- PART 8: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can delete their own profile (optional)
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- Success notification for RLS
DO $$
BEGIN
  RAISE NOTICE '✓ Created Row Level Security policies';
END $$;

-- =====================================================
-- PART 9: GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT INSERT ON profiles TO authenticated;
GRANT DELETE ON profiles TO authenticated;

-- Success notification for permissions
DO $$
BEGIN
  RAISE NOTICE '✓ Granted permissions to authenticated users';
END $$;

-- =====================================================
-- PART 10: POST-MIGRATION VERIFICATION
-- =====================================================

-- Verify all columns exist
DO $$
DECLARE
  missing_columns TEXT[] := '{}';
  required_columns TEXT[] := ARRAY[
    'id', 'email', 'full_name', 'phone_number',
    'stock_account_number', 'avatar_url', 'zalo_id',
    'membership', 'membership_expires_at',
    'created_at', 'updated_at'
  ];
  col TEXT;
BEGIN
  FOREACH col IN ARRAY required_columns
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = col
    ) THEN
      missing_columns := array_append(missing_columns, col);
    END IF;
  END LOOP;

  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Missing columns: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '✓ All required columns exist';
  END IF;
END $$;

-- Verify indexes
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'profiles';

  RAISE NOTICE '✓ Created % indexes on profiles table', index_count;
END $$;

-- Verify RLS is enabled
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'profiles';

  IF rls_enabled THEN
    RAISE NOTICE '✓ Row Level Security is enabled';
  ELSE
    RAISE WARNING '⚠ Row Level Security is NOT enabled';
  END IF;
END $$;

-- Count policies
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'profiles';

  RAISE NOTICE '✓ Created % RLS policies', policy_count;
END $$;

-- =====================================================
-- PART 11: FINAL SUMMARY
-- =====================================================

DO $$
DECLARE
  total_users INTEGER;
  premium_users INTEGER;
  free_users INTEGER;
  zalo_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM profiles;
  SELECT COUNT(*) INTO premium_users FROM profiles WHERE membership = 'premium';
  SELECT COUNT(*) INTO free_users FROM profiles WHERE membership = 'free';
  SELECT COUNT(*) INTO zalo_users FROM profiles WHERE zalo_id IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║          MIGRATION COMPLETED SUCCESSFULLY             ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Database Statistics:';
  RAISE NOTICE '  • Total users: %', total_users;
  RAISE NOTICE '  • Premium users: %', premium_users;
  RAISE NOTICE '  • Free users: %', free_users;
  RAISE NOTICE '  • Zalo linked users: %', zalo_users;
  RAISE NOTICE '';
  RAISE NOTICE 'Schema Changes:';
  RAISE NOTICE '  ✓ Added: full_name, phone_number, stock_account_number';
  RAISE NOTICE '  ✓ Added: avatar_url, zalo_id, updated_at';
  RAISE NOTICE '  ✓ Added: membership, membership_expires_at';
  RAISE NOTICE '  ✓ Migrated: role → membership (user→free, vip→premium)';
  RAISE NOTICE '  ✓ Created: 4 performance indexes';
  RAISE NOTICE '  ✓ Created: updated_at auto-trigger';
  RAISE NOTICE '  ✓ Enabled: Row Level Security with 4 policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Deploy your Next.js app to Vercel';
  RAISE NOTICE '  2. Configure environment variables (see DEPLOYMENT_GUIDE.md)';
  RAISE NOTICE '  3. Set up Zalo OAuth redirect URIs';
  RAISE NOTICE '  4. Test the Zalo login flow';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
