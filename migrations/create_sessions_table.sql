-- Create user_sessions table for session tracking
-- This enables device management, session revocation, and security monitoring

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token text UNIQUE NOT NULL,

  -- Device information
  device_name text,
  device_type text CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  browser text,
  os text,

  -- Security tracking
  ip_address inet,
  user_agent text,
  fingerprint text,

  -- Activity tracking
  last_activity timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL,

  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can only view their own sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can create own sessions"
  ON user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout)
CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;

  RAISE NOTICE 'Cleaned up % expired sessions',
    (SELECT COUNT(*) FROM user_sessions WHERE is_active = false AND expires_at < now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old inactive sessions (older than 90 days)
CREATE OR REPLACE FUNCTION delete_old_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions
  WHERE is_active = false
    AND created_at < now() - INTERVAL '90 days';

  RAISE NOTICE 'Deleted old inactive sessions';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_activity on session update
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Comments
COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for device management and security';
COMMENT ON COLUMN user_sessions.session_token IS 'Unique session token from Supabase Auth';
COMMENT ON COLUMN user_sessions.device_name IS 'Human-readable device name (e.g., "Chrome on Windows")';
COMMENT ON COLUMN user_sessions.fingerprint IS 'Browser fingerprint for suspicious activity detection';
COMMENT ON COLUMN user_sessions.is_active IS 'False when session is revoked or expired';
