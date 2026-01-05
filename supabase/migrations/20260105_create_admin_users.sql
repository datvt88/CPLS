-- Migration: Create admin_users table for admin dashboard
-- This table stores administrator accounts who can access the admin dashboard

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_users_updated_at();

-- Insert sample admin users for testing
-- Password should be hashed in production, these are for development only
INSERT INTO public.admin_users (email, username, full_name, role, active) VALUES
  ('admin@cpls.com', 'admin', 'System Administrator', 'super_admin', true),
  ('manager@cpls.com', 'manager', 'Dashboard Manager', 'admin', true),
  ('viewer@cpls.com', 'viewer', 'View Only User', 'viewer', true)
ON CONFLICT (email) DO NOTHING;

-- Optional: Enable Row Level Security (RLS) if needed
-- Note: The backend will bypass RLS using session_replication_role when using service_role key
-- ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Optional: Create RLS policy for service role
-- CREATE POLICY "Service role can manage admin users"
--   ON public.admin_users
--   FOR ALL
--   TO service_role
--   USING (true)
--   WITH CHECK (true);

-- Verify the table was created
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- Check sample data
SELECT 
  id,
  email,
  username,
  full_name,
  role,
  active,
  created_at
FROM public.admin_users;
