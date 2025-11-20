-- Migration 006: Add Admin Role System
-- This migration adds role-based access control to the profiles table

-- Add role field to profiles table
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('user', 'mod', 'admin'));

-- Create index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create index for membership queries
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON profiles(membership);

-- Add comment to role column
COMMENT ON COLUMN profiles.role IS 'User role: user (default), mod (moderator), admin (administrator)';

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

-- Enable RLS policies for admin actions
-- Only admins/mods can update other users' roles and memberships
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  USING (
    auth.uid() = id OR
    is_admin_or_mod(auth.uid())
  );

-- Verification query
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name = 'role';
