-- Migration: Add nickname field for chat room display
-- This adds a separate nickname field for use in real-time chat

-- Add nickname column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Create index for faster lookup by nickname
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname);

-- Add comment explaining the field
COMMENT ON COLUMN profiles.nickname IS 'Display name for chat rooms and real-time messaging. Can be different from full_name.';

-- Optional: Add a check to ensure nickname has reasonable length
ALTER TABLE profiles ADD CONSTRAINT nickname_length_check
  CHECK (nickname IS NULL OR (char_length(nickname) >= 2 AND char_length(nickname) <= 50));
