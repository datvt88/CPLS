-- Create OTP codes table for ZNS verification
-- This table stores temporary OTP codes sent via Zalo ZNS

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for fast lookup by phone number
  CONSTRAINT otp_codes_phone_idx UNIQUE (phone_number)
);

-- Create index for cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS otp_codes_expires_at_idx ON otp_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for API routes)
CREATE POLICY "Service role can manage OTP codes"
  ON otp_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to cleanup expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM otp_codes
  WHERE expires_at < NOW();
END;
$$;

-- Comment
COMMENT ON TABLE otp_codes IS 'Stores temporary OTP codes for phone verification via Zalo ZNS';
COMMENT ON COLUMN otp_codes.phone_number IS 'Phone number in format: 0xxxxxxxxx or +84xxxxxxxxx';
COMMENT ON COLUMN otp_codes.otp_code IS '6-digit OTP code';
COMMENT ON COLUMN otp_codes.expires_at IS 'OTP expiration time (typically 5 minutes from creation)';
COMMENT ON COLUMN otp_codes.verified IS 'Whether this OTP has been successfully verified';
