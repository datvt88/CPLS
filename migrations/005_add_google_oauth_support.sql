-- Migration: Add Google OAuth support
-- Update profiles table to support Google authentication

-- Make phone_number optional (nullable) for Google OAuth users
ALTER TABLE profiles
  ALTER COLUMN phone_number DROP NOT NULL;

-- Update phone_number constraint to allow empty/null
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS phone_format_check;

ALTER TABLE profiles
  ADD CONSTRAINT phone_format_check
  CHECK (phone_number IS NULL OR phone_number ~ '^[0-9+\-\s()]{9,20}$');

-- Add provider field to track authentication provider
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'email';

-- Add provider_id to track OAuth provider user ID
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provider_id text;

-- Update email constraint to allow it to be the unique identifier
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_email_key;

-- Make email unique again (for Google OAuth)
ALTER TABLE profiles
  ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- Create index for provider lookup
CREATE INDEX IF NOT EXISTS idx_profiles_provider ON profiles(provider);
CREATE INDEX IF NOT EXISTS idx_profiles_provider_id ON profiles(provider_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.phone_number IS 'Phone number - required for phone auth, optional for Google OAuth';
COMMENT ON COLUMN profiles.provider IS 'Authentication provider: email, google, zalo, etc.';
COMMENT ON COLUMN profiles.provider_id IS 'OAuth provider user ID (e.g., Google sub)';

-- Function to auto-create/update profile on user signup/signin
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
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
    provider = COALESCE(EXCLUDED.provider, profiles.provider),
    provider_id = COALESCE(EXCLUDED.provider_id, profiles.provider_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
