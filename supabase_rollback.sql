-- =====================================================
-- CPLS Database Rollback Script
-- Version: 1.0
-- Date: 2025-01-07
-- Description: Rollback Zalo OAuth migration
-- ⚠️ WARNING: This will remove Zalo integration data!
-- =====================================================

-- ⚠️ SAFETY CHECK
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║               ⚠️  ROLLBACK SCRIPT  ⚠️                  ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'This script will:';
  RAISE NOTICE '  • Remove Zalo integration columns (zalo_id, avatar_url)';
  RAISE NOTICE '  • Remove user profile columns (full_name, phone_number, stock_account_number)';
  RAISE NOTICE '  • Revert membership → role (premium→vip, free→user)';
  RAISE NOTICE '  • Remove RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  DATA LOSS WARNING:';
  RAISE NOTICE '  - All Zalo linked accounts will be unlinked';
  RAISE NOTICE '  - User profile data will be lost';
  RAISE NOTICE '  - This action cannot be undone!';
  RAISE NOTICE '';
  RAISE NOTICE 'To proceed, you must manually confirm by running the commands below.';
  RAISE NOTICE '';
END $$;

-- Uncomment the following lines to execute rollback:
--
-- -- =====================================================
-- -- STEP 1: BACKUP DATA (OPTIONAL BUT RECOMMENDED)
-- -- =====================================================
--
-- -- Create backup table
-- CREATE TABLE profiles_backup_20250107 AS SELECT * FROM profiles;
--
-- -- =====================================================
-- -- STEP 2: RE-ADD ROLE COLUMN
-- -- =====================================================
--
-- -- Add role column back
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
--
-- -- Migrate membership → role
-- UPDATE profiles SET role =
--   CASE
--     WHEN membership = 'premium' THEN 'vip'
--     WHEN membership = 'free' THEN 'user'
--     ELSE 'user'
--   END;
--
-- -- Add check constraint
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IN ('user','vip'));
--
-- -- =====================================================
-- -- STEP 3: REMOVE NEW COLUMNS
-- -- =====================================================
--
-- -- Drop Zalo integration columns
-- ALTER TABLE profiles DROP COLUMN IF EXISTS zalo_id;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS avatar_url;
--
-- -- Drop user profile columns
-- ALTER TABLE profiles DROP COLUMN IF EXISTS full_name;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS phone_number;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS stock_account_number;
--
-- -- Drop membership columns
-- ALTER TABLE profiles DROP COLUMN IF EXISTS membership;
-- ALTER TABLE profiles DROP COLUMN IF EXISTS membership_expires_at;
--
-- -- Drop updated_at
-- ALTER TABLE profiles DROP COLUMN IF EXISTS updated_at;
--
-- -- =====================================================
-- -- STEP 4: REMOVE INDEXES
-- -- =====================================================
--
-- DROP INDEX IF EXISTS idx_profiles_zalo_id;
-- DROP INDEX IF EXISTS idx_profiles_phone_number;
-- DROP INDEX IF EXISTS idx_profiles_membership;
--
-- -- =====================================================
-- -- STEP 5: REMOVE TRIGGERS
-- -- =====================================================
--
-- DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
--
-- -- =====================================================
-- -- STEP 6: UPDATE RLS POLICIES
-- -- =====================================================
--
-- -- Drop new policies
-- DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
-- DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
-- DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
-- DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
--
-- -- Recreate original policies (if needed)
-- -- Uncomment if you had different policies before:
-- -- CREATE POLICY "Users can view own profile"
-- --   ON profiles FOR SELECT
-- --   USING (auth.uid() = id);
--
-- -- =====================================================
-- -- STEP 7: VERIFY ROLLBACK
-- -- =====================================================
--
-- DO $$
-- DECLARE
--   col_count INTEGER;
--   has_role BOOLEAN;
--   has_membership BOOLEAN;
-- BEGIN
--   -- Count columns
--   SELECT COUNT(*) INTO col_count
--   FROM information_schema.columns
--   WHERE table_name = 'profiles';
--
--   -- Check for role column
--   SELECT EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_name = 'profiles' AND column_name = 'role'
--   ) INTO has_role;
--
--   -- Check for membership column
--   SELECT EXISTS (
--     SELECT 1 FROM information_schema.columns
--     WHERE table_name = 'profiles' AND column_name = 'membership'
--   ) INTO has_membership;
--
--   RAISE NOTICE '';
--   RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
--   RAISE NOTICE '║          ROLLBACK COMPLETED SUCCESSFULLY              ║';
--   RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
--   RAISE NOTICE '';
--   RAISE NOTICE 'Verification:';
--   RAISE NOTICE '  • Total columns: %', col_count;
--   RAISE NOTICE '  • Has role column: %', has_role;
--   RAISE NOTICE '  • Has membership column: %', has_membership;
--   RAISE NOTICE '';
--   RAISE NOTICE 'Next Steps:';
--   RAISE NOTICE '  1. Verify data integrity';
--   RAISE NOTICE '  2. Check backup table: profiles_backup_20250107';
--   RAISE NOTICE '  3. Rollback application code if needed';
--   RAISE NOTICE '';
-- END $$;

-- =====================================================
-- ALTERNATIVE: SOFT ROLLBACK (Keep data but disable features)
-- =====================================================
--
-- If you want to keep the data but disable Zalo features:
--
-- -- Set all zalo_id to NULL (unlink accounts)
-- UPDATE profiles SET zalo_id = NULL;
--
-- -- Revert all premium to free
-- UPDATE profiles SET membership = 'free' WHERE membership = 'premium';
--
-- -- Clear membership expiration
-- UPDATE profiles SET membership_expires_at = NULL;

-- =====================================================
-- END OF ROLLBACK SCRIPT
-- =====================================================

-- To restore from backup (if you created one):
--
-- DROP TABLE profiles;
-- ALTER TABLE profiles_backup_20250107 RENAME TO profiles;
