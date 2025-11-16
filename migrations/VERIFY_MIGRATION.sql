-- ============================================================================
-- VERIFY ZALO MIGRATION SCRIPT
-- ============================================================================
-- Script này kiểm tra xem migrations đã chạy thành công chưa
-- Chạy script này AFTER running COMPLETE_ZALO_MIGRATION.sql
-- ============================================================================

DO $$
DECLARE
  columns_exist BOOLEAN;
  indexes_exist BOOLEAN;
  policies_exist BOOLEAN;
  trigger_exists BOOLEAN;
  all_good BOOLEAN := TRUE;
  missing_columns TEXT[];
  missing_indexes TEXT[];
  missing_policies TEXT[];
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '🔍 VERIFYING ZALO OAUTH MIGRATION';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';

  -- ============================================================================
  -- CHECK 1: VERIFY COLUMNS EXIST
  -- ============================================================================
  RAISE NOTICE '📋 Checking columns...';

  -- Required columns
  SELECT ARRAY(
    SELECT column_name
    FROM (VALUES
      ('full_name'),
      ('phone_number'),
      ('nickname'),
      ('stock_account_number'),
      ('avatar_url'),
      ('zalo_id'),
      ('birthday'),
      ('gender'),
      ('membership'),
      ('membership_expires_at'),
      ('updated_at'),
      ('tcbs_api_key'),
      ('tcbs_connected_at')
    ) AS required(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = required.column_name
    )
  ) INTO missing_columns;

  IF array_length(missing_columns, 1) > 0 THEN
    RAISE NOTICE '❌ Missing columns: %', array_to_string(missing_columns, ', ');
    all_good := FALSE;
  ELSE
    RAISE NOTICE '✅ All required columns exist';
  END IF;

  -- Check column constraints
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'zalo_id' AND is_nullable = 'YES') THEN
    RAISE NOTICE '✅ zalo_id allows NULL (correct)';
  ELSE
    RAISE NOTICE '⚠️  zalo_id constraint issue';
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- CHECK 2: VERIFY INDEXES
  -- ============================================================================
  RAISE NOTICE '🔍 Checking indexes...';

  SELECT ARRAY(
    SELECT index_name
    FROM (VALUES
      ('idx_profiles_zalo_id'),
      ('idx_profiles_phone_number'),
      ('idx_profiles_membership'),
      ('idx_profiles_nickname')
    ) AS required(index_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'profiles' AND indexname = required.index_name
    )
  ) INTO missing_indexes;

  IF array_length(missing_indexes, 1) > 0 THEN
    RAISE NOTICE '❌ Missing indexes: %', array_to_string(missing_indexes, ', ');
    all_good := FALSE;
  ELSE
    RAISE NOTICE '✅ All required indexes exist';
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- CHECK 3: VERIFY RLS POLICIES
  -- ============================================================================
  RAISE NOTICE '🔒 Checking RLS policies...';

  -- Check if RLS is enabled
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND rowsecurity = TRUE) THEN
    RAISE NOTICE '✅ Row Level Security is ENABLED';
  ELSE
    RAISE NOTICE '❌ Row Level Security is DISABLED';
    all_good := FALSE;
  END IF;

  -- Check policies
  SELECT ARRAY(
    SELECT policy_name
    FROM (VALUES
      ('Users can view own profile'),
      ('Users can update own profile'),
      ('Users can insert own profile')
    ) AS required(policy_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'profiles' AND policyname = required.policy_name
    )
  ) INTO missing_policies;

  IF array_length(missing_policies, 1) > 0 THEN
    RAISE NOTICE '❌ Missing policies: %', array_to_string(missing_policies, ', ');
    all_good := FALSE;
  ELSE
    RAISE NOTICE '✅ All required RLS policies exist';
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- CHECK 4: VERIFY TRIGGER
  -- ============================================================================
  RAISE NOTICE '⚙️  Checking triggers...';

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    RAISE NOTICE '✅ auto-update trigger exists';
  ELSE
    RAISE NOTICE '❌ auto-update trigger missing';
    all_good := FALSE;
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- CHECK 5: VERIFY CONSTRAINTS
  -- ============================================================================
  RAISE NOTICE '🔐 Checking constraints...';

  -- Gender constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%gender%check%'
  ) THEN
    RAISE NOTICE '✅ gender CHECK constraint exists';
  ELSE
    RAISE NOTICE '⚠️  gender CHECK constraint missing (optional)';
  END IF;

  -- Membership constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname LIKE '%membership%check%'
  ) THEN
    RAISE NOTICE '✅ membership CHECK constraint exists';
  ELSE
    RAISE NOTICE '⚠️  membership CHECK constraint missing (optional)';
  END IF;

  RAISE NOTICE '';

  -- ============================================================================
  -- CHECK 6: SAMPLE DATA
  -- ============================================================================
  RAISE NOTICE '📊 Checking existing data...';

  DECLARE
    total_profiles INTEGER;
    zalo_profiles INTEGER;
    profiles_with_membership INTEGER;
  BEGIN
    SELECT COUNT(*) INTO total_profiles FROM profiles;
    SELECT COUNT(*) INTO zalo_profiles FROM profiles WHERE zalo_id IS NOT NULL;
    SELECT COUNT(*) INTO profiles_with_membership FROM profiles WHERE membership IS NOT NULL;

    RAISE NOTICE 'Total profiles: %', total_profiles;
    RAISE NOTICE 'Profiles with Zalo ID: %', zalo_profiles;
    RAISE NOTICE 'Profiles with membership: %', profiles_with_membership;

    IF total_profiles > 0 AND profiles_with_membership = 0 THEN
      RAISE NOTICE '⚠️  Warning: Existing profiles have NULL membership';
      RAISE NOTICE '   Run: UPDATE profiles SET membership = ''free'' WHERE membership IS NULL;';
    END IF;
  END;

  RAISE NOTICE '';

  -- ============================================================================
  -- FINAL RESULT
  -- ============================================================================
  RAISE NOTICE '============================================================================';
  IF all_good THEN
    RAISE NOTICE '🎉 VERIFICATION PASSED - Migration is complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Your database is ready for Zalo OAuth integration.';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Deploy your Next.js app';
    RAISE NOTICE '  2. Configure Zalo Developer Console';
    RAISE NOTICE '  3. Test login with Zalo';
  ELSE
    RAISE NOTICE '⚠️  VERIFICATION FAILED - Some issues detected';
    RAISE NOTICE '';
    RAISE NOTICE 'Please review the errors above and:';
    RAISE NOTICE '  1. Re-run COMPLETE_ZALO_MIGRATION.sql';
    RAISE NOTICE '  2. Or manually fix the missing items';
    RAISE NOTICE '  3. Then run this verification script again';
  END IF;
  RAISE NOTICE '============================================================================';

END $$;
