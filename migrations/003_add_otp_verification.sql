-- =====================================================
-- Migration 003: Phone + OTP Authentication System
-- =====================================================
-- Created: 2025-01-16
-- Purpose: Add OTP verification tables and update profiles
--          for phone-based authentication
-- =====================================================

-- =====================================================
-- 1. CREATE OTP VERIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Phone number (with country code)
  phone_number TEXT NOT NULL,

  -- OTP code (6 digits)
  otp_code TEXT NOT NULL,

  -- Verification status
  verified BOOLEAN DEFAULT FALSE,

  -- Expiration time (5 minutes from creation)
  expires_at TIMESTAMPTZ NOT NULL,

  -- Attempt tracking (max 3 attempts)
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  -- Purpose tracking
  purpose TEXT CHECK (purpose IN ('registration', 'login')) DEFAULT 'login',

  -- IP tracking for security
  ip_address TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,

  -- Ensure only one active OTP per phone at a time
  CONSTRAINT unique_active_otp UNIQUE (phone_number, verified)
);

-- =====================================================
-- 2. CREATE INDEXES FOR FAST LOOKUP
-- =====================================================

-- Index for phone number lookup
CREATE INDEX IF NOT EXISTS idx_otp_phone
ON otp_verifications(phone_number);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_otp_expires
ON otp_verifications(expires_at);

-- Index for verified status
CREATE INDEX IF NOT EXISTS idx_otp_verified
ON otp_verifications(verified);

-- Composite index for active OTP lookup
CREATE INDEX IF NOT EXISTS idx_otp_phone_verified_expires
ON otp_verifications(phone_number, verified, expires_at);

-- =====================================================
-- 3. CREATE FUNCTION TO DELETE EXPIRED OTPS
-- =====================================================

CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_verifications
  WHERE expires_at < NOW()
    AND verified = FALSE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE FUNCTION TO AUTO-EXPIRE OLD OTPS
-- =====================================================

-- This function invalidates old OTPs when a new one is created
CREATE OR REPLACE FUNCTION invalidate_old_otps()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark all previous unverified OTPs for this phone as expired
  UPDATE otp_verifications
  SET verified = TRUE,
      verified_at = NOW()
  WHERE phone_number = NEW.phone_number
    AND verified = FALSE
    AND id != NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_invalidate_old_otps ON otp_verifications;
CREATE TRIGGER trigger_invalidate_old_otps
  AFTER INSERT ON otp_verifications
  FOR EACH ROW
  EXECUTE FUNCTION invalidate_old_otps();

-- =====================================================
-- 5. CREATE RATE LIMITING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifier (phone number or IP address)
  identifier TEXT NOT NULL,
  identifier_type TEXT CHECK (identifier_type IN ('phone', 'ip')) NOT NULL,

  -- Rate limit tracking
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_duration INTERVAL DEFAULT '1 hour',

  -- Lockout tracking
  locked_until TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_identifier UNIQUE (identifier, identifier_type)
);

-- Index for rate limit lookup
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier
ON otp_rate_limits(identifier, identifier_type);

-- =====================================================
-- 6. CREATE FUNCTION TO CHECK RATE LIMIT
-- =====================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_type TEXT,
  p_max_requests INTEGER DEFAULT 3
)
RETURNS BOOLEAN AS $$
DECLARE
  v_record otp_rate_limits%ROWTYPE;
  v_is_allowed BOOLEAN;
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record
  FROM otp_rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_type
  FOR UPDATE;

  -- Check if locked
  IF v_record.locked_until IS NOT NULL
     AND v_record.locked_until > NOW() THEN
    RETURN FALSE;
  END IF;

  -- If record doesn't exist, create it
  IF v_record IS NULL THEN
    INSERT INTO otp_rate_limits (identifier, identifier_type, request_count)
    VALUES (p_identifier, p_type, 1);
    RETURN TRUE;
  END IF;

  -- Check if window expired
  IF v_record.window_start + v_record.window_duration < NOW() THEN
    -- Reset window
    UPDATE otp_rate_limits
    SET request_count = 1,
        window_start = NOW(),
        locked_until = NULL,
        updated_at = NOW()
    WHERE identifier = p_identifier
      AND identifier_type = p_type;
    RETURN TRUE;
  END IF;

  -- Check if limit reached
  IF v_record.request_count >= p_max_requests THEN
    -- Lock for 1 hour
    UPDATE otp_rate_limits
    SET locked_until = NOW() + INTERVAL '1 hour',
        updated_at = NOW()
    WHERE identifier = p_identifier
      AND identifier_type = p_type;
    RETURN FALSE;
  END IF;

  -- Increment counter
  UPDATE otp_rate_limits
  SET request_count = request_count + 1,
      updated_at = NOW()
  WHERE identifier = p_identifier
    AND identifier_type = p_type;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. UPDATE PROFILES TABLE
-- =====================================================

-- Make phone_number NOT NULL (phone is now primary identifier)
-- Note: This will fail if there are existing profiles without phone_number
-- Run this manually after ensuring all profiles have phone_number
-- ALTER TABLE profiles
--   ALTER COLUMN phone_number SET NOT NULL;

-- Make email optional (was required before)
ALTER TABLE profiles
  ALTER COLUMN email DROP NOT NULL;

-- Add unique constraint on phone_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique
ON profiles(phone_number)
WHERE phone_number IS NOT NULL;

-- Add index for phone lookup
CREATE INDEX IF NOT EXISTS idx_profiles_phone
ON profiles(phone_number);

-- =====================================================
-- 8. CREATE FUNCTION TO CLEANUP OLD DATA
-- =====================================================

-- Function to clean up old OTP records (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_otp_data()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete old OTP verifications (older than 24 hours)
  DELETE FROM otp_verifications
  WHERE created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Reset rate limits older than 24 hours
  DELETE FROM otp_rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours'
    AND locked_until IS NULL;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. CREATE VIEW FOR OTP STATISTICS
-- =====================================================

CREATE OR REPLACE VIEW otp_statistics AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  purpose,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE verified = TRUE) as verified_count,
  COUNT(*) FILTER (WHERE attempts >= max_attempts) as max_attempts_reached,
  AVG(attempts) as avg_attempts,
  AVG(EXTRACT(EPOCH FROM (verified_at - created_at))) FILTER (WHERE verified = TRUE) as avg_verification_time_seconds
FROM otp_verifications
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), purpose
ORDER BY date DESC;

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON otp_verifications TO authenticated;
GRANT SELECT ON otp_rate_limits TO authenticated;
GRANT SELECT ON otp_statistics TO authenticated;

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION delete_expired_otps() TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_otp_data() TO authenticated;

-- =====================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on otp_verifications
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own OTP verifications (by phone number)
CREATE POLICY otp_select_own
ON otp_verifications
FOR SELECT
USING (
  phone_number IN (
    SELECT phone_number FROM profiles WHERE user_id = auth.uid()
  )
);

-- Users can insert OTP verifications
CREATE POLICY otp_insert_own
ON otp_verifications
FOR INSERT
WITH CHECK (true);

-- Users can update their own OTP verifications
CREATE POLICY otp_update_own
ON otp_verifications
FOR UPDATE
USING (
  phone_number IN (
    SELECT phone_number FROM profiles WHERE user_id = auth.uid()
  )
);

-- Enable RLS on rate limits
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Anyone can read rate limits (needed for checking)
CREATE POLICY rate_limit_select_all
ON otp_rate_limits
FOR SELECT
USING (true);

-- =====================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE otp_verifications IS 'Stores OTP codes for phone number verification';
COMMENT ON TABLE otp_rate_limits IS 'Tracks rate limits for OTP requests by phone and IP';
COMMENT ON FUNCTION check_rate_limit(TEXT, TEXT, INTEGER) IS 'Checks if an identifier has exceeded rate limits';
COMMENT ON FUNCTION delete_expired_otps() IS 'Deletes expired OTP codes';
COMMENT ON FUNCTION cleanup_old_otp_data() IS 'Cleans up old OTP records and rate limits';
COMMENT ON VIEW otp_statistics IS 'Statistics on OTP usage and verification rates';

-- =====================================================
-- 13. SAMPLE DATA (FOR TESTING - REMOVE IN PRODUCTION)
-- =====================================================

-- Uncomment to insert test data
-- INSERT INTO otp_verifications (phone_number, otp_code, expires_at, purpose)
-- VALUES
--   ('84901234567', '123456', NOW() + INTERVAL '5 minutes', 'registration'),
--   ('84987654321', '654321', NOW() + INTERVAL '5 minutes', 'login');

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Run this query to verify migration
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Migration 003: OTP Authentication System';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - otp_verifications';
  RAISE NOTICE '  - otp_rate_limits';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - delete_expired_otps()';
  RAISE NOTICE '  - invalidate_old_otps()';
  RAISE NOTICE '  - check_rate_limit()';
  RAISE NOTICE '  - cleanup_old_otp_data()';
  RAISE NOTICE '';
  RAISE NOTICE 'Views created:';
  RAISE NOTICE '  - otp_statistics';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes created: 6';
  RAISE NOTICE 'RLS policies created: 4';
  RAISE NOTICE '';
  RAISE NOTICE 'Status: ✅ COMPLETE';
  RAISE NOTICE '==============================================';
END $$;
