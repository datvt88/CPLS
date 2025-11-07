-- =====================================================
-- CPLS Simple Database Migration
-- Description: Add Zalo OAuth and TCBS integration
-- Usage: Copy and paste this entire file into Supabase SQL Editor
-- =====================================================

-- Step 1: Add new columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stock_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zalo_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership TEXT DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tcbs_api_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tcbs_connected_at TIMESTAMPTZ;

-- Step 2: Add unique constraint to zalo_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_zalo_id_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_zalo_id_key UNIQUE (zalo_id);
  END IF;
END $$;

-- Step 3: Add check constraint for membership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_membership_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_membership_check
      CHECK (membership IN ('free','premium'));
  END IF;
END $$;

-- Step 4: Migrate existing role data (if role column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    UPDATE profiles SET membership =
      CASE
        WHEN role = 'vip' THEN 'premium'
        WHEN role = 'user' THEN 'free'
        ELSE 'free'
      END
    WHERE membership IS NULL OR membership = 'free';

    ALTER TABLE profiles DROP COLUMN IF EXISTS role;
  END IF;
END $$;

-- Step 5: Set default membership for existing users
UPDATE profiles SET membership = 'free' WHERE membership IS NULL;

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON profiles(membership);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Step 7: Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 9: Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 10: Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Step 11: Create RLS policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- Step 12: Grant permissions
GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT INSERT ON profiles TO authenticated;
GRANT DELETE ON profiles TO authenticated;

-- Step 13: Add comments for TCBS fields
COMMENT ON COLUMN profiles.tcbs_api_key IS 'TCBS API key - stored encrypted in application layer';
COMMENT ON COLUMN profiles.tcbs_connected_at IS 'Timestamp when TCBS API was last successfully connected';

-- Migration completed!
-- Next steps:
-- 1. Deploy your Next.js app to Vercel
-- 2. Configure environment variables (NEXT_PUBLIC_ZALO_APP_ID, ZALO_APP_SECRET)
-- 3. Set up Zalo OAuth redirect URIs
-- 4. Test the Zalo login flow
