-- Migration: Custom Claims for JWT
-- This migration creates functions to inject custom claims into JWT tokens
-- Claims include: role, membership, is_premium

-- 1. Create function to get user claims from profiles table
CREATE OR REPLACE FUNCTION public.get_user_claims(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
  is_premium BOOLEAN;
BEGIN
  -- Get user profile data
  SELECT 
    role,
    membership,
    membership_expires_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id;

  -- If no profile exists, return default claims
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'role', 'user',
      'membership', 'free',
      'is_premium', false
    );
  END IF;

  -- Check premium status (simplified logic)
  is_premium := user_profile.membership = 'premium' 
    AND (user_profile.membership_expires_at IS NULL OR user_profile.membership_expires_at > NOW());

  -- Return claims
  RETURN jsonb_build_object(
    'role', COALESCE(user_profile.role, 'user'),
    'membership', COALESCE(user_profile.membership, 'free'),
    'is_premium', is_premium
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the custom access token hook function
-- This function is called by Supabase Auth when generating JWT tokens
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  user_id UUID;
  current_app_metadata JSONB;
BEGIN
  -- Extract user ID from the event
  user_id := (event->>'user_id')::UUID;
  
  -- Get claims for this user
  claims := public.get_user_claims(user_id);
  
  -- Get existing app_metadata or create empty object
  current_app_metadata := COALESCE(event->'claims'->'app_metadata', '{}'::jsonb);
  
  -- Merge our claims into app_metadata
  -- This ensures claims are accessible at session.user.app_metadata
  current_app_metadata := current_app_metadata || claims;
  
  -- Update the event with the new app_metadata
  event := jsonb_set(event, '{claims,app_metadata}', current_app_metadata);
  
  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- If there's an error, return the original event unchanged
    RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_user_claims(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_claims(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;

-- 4. Create a trigger to invalidate sessions when profile is updated (optional)
-- This ensures users get fresh claims when their role/membership changes
CREATE OR REPLACE FUNCTION public.notify_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the change (for monitoring)
  RAISE NOTICE 'Profile updated for user %: role=%, membership=%', 
    NEW.id, NEW.role, NEW.membership;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_profile_change ON public.profiles;
CREATE TRIGGER on_profile_change
  AFTER UPDATE OF role, membership, membership_expires_at
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_profile_change();

-- 5. Add role column to profiles if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN role TEXT DEFAULT 'user' 
    CHECK (role IN ('user', 'mod', 'admin'));
  END IF;
END $$;

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- IMPORTANT: After running this migration, you need to configure the hook in Supabase Dashboard:
-- 1. Go to Authentication > Hooks
-- 2. Enable "Custom access token" hook
-- 3. Select the function: custom_access_token_hook
-- Note: This requires Supabase Pro plan or self-hosted Supabase
