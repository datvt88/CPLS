-- =====================================================
-- Migration: Add TCBS API Integration
-- Version: 1.1
-- Date: 2025-01-07
-- Description: Add fields for TCBS brokerage API integration
-- =====================================================

-- Add TCBS integration columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tcbs_api_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tcbs_connected_at TIMESTAMPTZ;

RAISE NOTICE '✓ Added TCBS integration columns';

-- Add comment to explain encrypted storage
COMMENT ON COLUMN profiles.tcbs_api_key IS 'TCBS API key - stored encrypted in application layer';
COMMENT ON COLUMN profiles.tcbs_connected_at IS 'Timestamp when TCBS API was last successfully connected';

RAISE NOTICE '✓ Added column comments';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║     TCBS INTEGRATION MIGRATION COMPLETED              ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Added fields:';
  RAISE NOTICE '  • tcbs_api_key - For storing TCBS brokerage API key';
  RAISE NOTICE '  • tcbs_connected_at - Last connection timestamp';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Update profile.service.ts with TCBS methods';
  RAISE NOTICE '  2. Add TCBS section in profile page';
  RAISE NOTICE '  3. Implement API key encryption';
  RAISE NOTICE '  4. Create TCBS API integration service';
  RAISE NOTICE '';
END $$;
