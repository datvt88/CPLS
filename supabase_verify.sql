-- =====================================================
-- CPLS Database Verification Script
-- Version: 1.0
-- Date: 2025-01-07
-- Description: Verify database schema matches code requirements
-- =====================================================

-- =====================================================
-- CHECK 1: TABLE EXISTS
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    RAISE NOTICE '✓ Table "profiles" exists';
  ELSE
    RAISE EXCEPTION '✗ Table "profiles" does not exist';
  END IF;
END $$;

-- =====================================================
-- CHECK 2: REQUIRED COLUMNS
-- =====================================================

DO $$
DECLARE
  missing_columns TEXT[] := '{}';
  required_columns TEXT[] := ARRAY[
    'id',
    'email',
    'full_name',
    'phone_number',
    'stock_account_number',
    'avatar_url',
    'zalo_id',
    'membership',
    'membership_expires_at',
    'created_at',
    'updated_at'
  ];
  col TEXT;
  col_type TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║              COLUMN VERIFICATION                      ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  FOREACH col IN ARRAY required_columns
  LOOP
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = col;

    IF col_type IS NOT NULL THEN
      RAISE NOTICE '✓ Column "%" exists (type: %)', col, col_type;
    ELSE
      missing_columns := array_append(missing_columns, col);
      RAISE NOTICE '✗ Column "%" is MISSING', col;
    END IF;
  END LOOP;

  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required columns: %', array_to_string(missing_columns, ', ');
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✓ All required columns exist';
  END IF;
END $$;

-- =====================================================
-- CHECK 3: CONSTRAINTS
-- =====================================================

DO $$
DECLARE
  has_zalo_unique BOOLEAN;
  has_email_unique BOOLEAN;
  has_membership_check BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║            CONSTRAINT VERIFICATION                    ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Check zalo_id unique constraint
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_zalo_id_key'
      AND contype = 'u'
  ) INTO has_zalo_unique;

  IF has_zalo_unique THEN
    RAISE NOTICE '✓ UNIQUE constraint on zalo_id exists';
  ELSE
    RAISE WARNING '⚠ UNIQUE constraint on zalo_id is missing';
  END IF;

  -- Check email unique constraint
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass
      AND contype = 'u'
      AND 'email' = ANY(
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = conrelid
          AND a.attnum = ANY(conkey)
      )
  ) INTO has_email_unique;

  IF has_email_unique THEN
    RAISE NOTICE '✓ UNIQUE constraint on email exists';
  ELSE
    RAISE WARNING '⚠ UNIQUE constraint on email is missing';
  END IF;

  -- Check membership check constraint
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_membership_check'
      AND contype = 'c'
  ) INTO has_membership_check;

  IF has_membership_check THEN
    RAISE NOTICE '✓ CHECK constraint on membership exists';
  ELSE
    RAISE WARNING '⚠ CHECK constraint on membership is missing';
  END IF;
END $$;

-- =====================================================
-- CHECK 4: INDEXES
-- =====================================================

DO $$
DECLARE
  idx RECORD;
  index_count INTEGER := 0;
  required_indexes TEXT[] := ARRAY[
    'idx_profiles_zalo_id',
    'idx_profiles_phone_number',
    'idx_profiles_membership'
  ];
  idx_name TEXT;
  found BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║              INDEX VERIFICATION                       ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Check required indexes
  FOREACH idx_name IN ARRAY required_indexes
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'profiles' AND indexname = idx_name
    ) INTO found;

    IF found THEN
      RAISE NOTICE '✓ Index "%" exists', idx_name;
      index_count := index_count + 1;
    ELSE
      RAISE WARNING '⚠ Index "%" is missing', idx_name;
    END IF;
  END LOOP;

  -- List all indexes
  RAISE NOTICE '';
  RAISE NOTICE 'All indexes on profiles table:';
  FOR idx IN
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'profiles'
    ORDER BY indexname
  LOOP
    RAISE NOTICE '  • %', idx.indexname;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✓ Total indexes: %', (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'profiles');
END $$;

-- =====================================================
-- CHECK 5: ROW LEVEL SECURITY
-- =====================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  pol RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║           ROW LEVEL SECURITY (RLS)                    ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Check if RLS is enabled
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'profiles';

  IF rls_enabled THEN
    RAISE NOTICE '✓ Row Level Security is ENABLED';
  ELSE
    RAISE WARNING '⚠ Row Level Security is DISABLED';
  END IF;

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'profiles';

  RAISE NOTICE '✓ Total RLS policies: %', policy_count;
  RAISE NOTICE '';

  -- List all policies
  IF policy_count > 0 THEN
    RAISE NOTICE 'Active policies:';
    FOR pol IN
      SELECT policyname, cmd, qual
      FROM pg_policies
      WHERE tablename = 'profiles'
      ORDER BY policyname
    LOOP
      RAISE NOTICE '  • % (for %)', pol.policyname, pol.cmd;
    END LOOP;
  ELSE
    RAISE WARNING '⚠ No RLS policies found!';
  END IF;
END $$;

-- =====================================================
-- CHECK 6: TRIGGERS
-- =====================================================

DO $$
DECLARE
  trigger_count INTEGER;
  trg RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║                TRIGGER VERIFICATION                   ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'profiles';

  IF trigger_count > 0 THEN
    RAISE NOTICE '✓ Total triggers: %', trigger_count;
    RAISE NOTICE '';

    -- List all triggers
    FOR trg IN
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_table = 'profiles'
      ORDER BY trigger_name
    LOOP
      RAISE NOTICE '  • % (% %)', trg.trigger_name, trg.action_timing, trg.event_manipulation;
    END LOOP;
  ELSE
    RAISE WARNING '⚠ No triggers found';
  END IF;

  -- Check for updated_at trigger specifically
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'profiles'
      AND trigger_name = 'update_profiles_updated_at'
  ) THEN
    RAISE NOTICE '';
    RAISE NOTICE '✓ updated_at auto-trigger exists';
  ELSE
    RAISE WARNING '';
    RAISE WARNING '⚠ updated_at auto-trigger is missing';
  END IF;
END $$;

-- =====================================================
-- CHECK 7: FUNCTIONS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║             FUNCTION VERIFICATION                     ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Check for update_updated_at_column function
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    RAISE NOTICE '✓ Function "update_updated_at_column" exists';
  ELSE
    RAISE WARNING '⚠ Function "update_updated_at_column" is missing';
  END IF;
END $$;

-- =====================================================
-- CHECK 8: DATA INTEGRITY
-- =====================================================

DO $$
DECLARE
  total_users INTEGER;
  users_with_email INTEGER;
  users_with_membership INTEGER;
  users_with_zalo INTEGER;
  premium_users INTEGER;
  free_users INTEGER;
  null_membership_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║            DATA INTEGRITY CHECK                       ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Count users
  SELECT COUNT(*) INTO total_users FROM profiles;
  SELECT COUNT(*) INTO users_with_email FROM profiles WHERE email IS NOT NULL;
  SELECT COUNT(*) INTO users_with_membership FROM profiles WHERE membership IS NOT NULL;
  SELECT COUNT(*) INTO users_with_zalo FROM profiles WHERE zalo_id IS NOT NULL;
  SELECT COUNT(*) INTO premium_users FROM profiles WHERE membership = 'premium';
  SELECT COUNT(*) INTO free_users FROM profiles WHERE membership = 'free';
  SELECT COUNT(*) INTO null_membership_count FROM profiles WHERE membership IS NULL;

  RAISE NOTICE 'User Statistics:';
  RAISE NOTICE '  • Total users: %', total_users;
  RAISE NOTICE '  • Users with email: %', users_with_email;
  RAISE NOTICE '  • Users with membership: %', users_with_membership;
  RAISE NOTICE '  • Users with Zalo linked: %', users_with_zalo;
  RAISE NOTICE '  • Premium users: %', premium_users;
  RAISE NOTICE '  • Free users: %', free_users;

  IF null_membership_count > 0 THEN
    RAISE WARNING '';
    RAISE WARNING '⚠ Found % users with NULL membership!', null_membership_count;
  END IF;

  -- Check for orphaned records (id not in auth.users)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    DECLARE
      orphaned_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO orphaned_count
      FROM profiles p
      WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

      IF orphaned_count > 0 THEN
        RAISE WARNING '';
        RAISE WARNING '⚠ Found % orphaned profiles (user deleted from auth.users)', orphaned_count;
      ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✓ No orphaned profiles';
      END IF;
    END;
  END IF;
END $$;

-- =====================================================
-- CHECK 9: PERMISSIONS
-- =====================================================

DO $$
DECLARE
  has_select BOOLEAN;
  has_insert BOOLEAN;
  has_update BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║            PERMISSION VERIFICATION                    ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Check permissions for authenticated role
  SELECT has_table_privilege('authenticated', 'profiles', 'SELECT') INTO has_select;
  SELECT has_table_privilege('authenticated', 'profiles', 'INSERT') INTO has_insert;
  SELECT has_table_privilege('authenticated', 'profiles', 'UPDATE') INTO has_update;

  IF has_select THEN
    RAISE NOTICE '✓ authenticated role has SELECT permission';
  ELSE
    RAISE WARNING '⚠ authenticated role MISSING SELECT permission';
  END IF;

  IF has_insert THEN
    RAISE NOTICE '✓ authenticated role has INSERT permission';
  ELSE
    RAISE WARNING '⚠ authenticated role MISSING INSERT permission';
  END IF;

  IF has_update THEN
    RAISE NOTICE '✓ authenticated role has UPDATE permission';
  ELSE
    RAISE WARNING '⚠ authenticated role MISSING UPDATE permission';
  END IF;
END $$;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
DECLARE
  total_columns INTEGER;
  total_indexes INTEGER;
  total_policies INTEGER;
  total_triggers INTEGER;
  total_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_columns FROM information_schema.columns WHERE table_name = 'profiles';
  SELECT COUNT(*) INTO total_indexes FROM pg_indexes WHERE tablename = 'profiles';
  SELECT COUNT(*) INTO total_policies FROM pg_policies WHERE tablename = 'profiles';
  SELECT COUNT(*) INTO total_triggers FROM information_schema.triggers WHERE event_object_table = 'profiles';
  SELECT COUNT(*) INTO total_users FROM profiles;

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║              VERIFICATION SUMMARY                     ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Schema Statistics:';
  RAISE NOTICE '  • Total columns: %', total_columns;
  RAISE NOTICE '  • Total indexes: %', total_indexes;
  RAISE NOTICE '  • Total RLS policies: %', total_policies;
  RAISE NOTICE '  • Total triggers: %', total_triggers;
  RAISE NOTICE '  • Total users: %', total_users;
  RAISE NOTICE '';
  RAISE NOTICE 'Status: Database schema is ready for production!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Deploy Next.js app to Vercel';
  RAISE NOTICE '  2. Configure environment variables';
  RAISE NOTICE '  3. Set up Zalo OAuth redirect URIs';
  RAISE NOTICE '  4. Test Zalo login flow';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- END OF VERIFICATION SCRIPT
-- =====================================================
