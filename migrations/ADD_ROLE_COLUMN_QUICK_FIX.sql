-- ============================================
-- ADD ROLE COLUMN TO EXISTING PROFILES TABLE
-- ============================================
-- Run this if you get error: column "role" does not exist

-- Step 1: Add role column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('user', 'mod', 'admin'));

        RAISE NOTICE '✅ Column "role" added successfully';
    ELSE
        RAISE NOTICE 'ℹ️ Column "role" already exists';
    END IF;
END $$;

-- Step 2: Create index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Step 3: Add comment to role column
COMMENT ON COLUMN profiles.role IS 'User role: user (default), mod (moderator), admin (administrator)';

-- Step 4: Create helper function
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

-- Step 5: Update RLS policies for admin access
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

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

-- Step 6: Verify role column exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN '✅ SUCCESS: Role column exists'
    ELSE '❌ ERROR: Role column not found'
  END AS status;

-- Step 7: Show all profiles with their roles
SELECT
  id,
  email,
  full_name,
  role,
  membership,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- NEXT STEP: Create your first admin user
-- ============================================
-- Replace YOUR_USER_ID with your actual user ID

-- Get your user ID:
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then set role to admin:
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';
