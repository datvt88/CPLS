-- Migration: Add birthday and gender fields from Zalo
-- These fields are available from Zalo Graph API v2.0

-- Add birthday field (stored as text in DD/MM/YYYY format from Zalo)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday TEXT;

-- Add gender field (values: "male", "female", or null)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Added fields: birthday, gender';
  RAISE NOTICE 'These fields are populated from Zalo Graph API v2.0';
END $$;
