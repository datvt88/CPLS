-- Add role field to profiles table for admin access control
-- Roles: 'user' (default), 'mod' (moderator), 'admin' (administrator)

-- Add role column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('user', 'mod', 'admin'));

    -- Create index for faster role lookups
    CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

    RAISE NOTICE 'Added role column to profiles table';
  ELSE
    RAISE NOTICE 'Role column already exists';
  END IF;
END $$;

-- Update existing users to have 'user' role if NULL
UPDATE profiles SET role = 'user' WHERE role IS NULL;

-- Example: Set admin role for specific user (replace with your admin email)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@example.com';
