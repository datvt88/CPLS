-- =====================================================
-- SUPABASE AUTH & PROFILE SETUP (NO CHAT)
-- =====================================================
-- Script thiết lập xác thực Zalo và quản lý profile người dùng
-- KHÔNG bao gồm tính năng chat
--
-- Profile fields:
-- - Email (bắt buộc)
-- - Số điện thoại (bắt buộc)
-- - Nickname (user tự đặt - hiển thị tài khoản)
-- - Số tài khoản chứng khoán (optional)
-- =====================================================

-- =====================================================
-- SECTION 1: BASE SCHEMA
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  phone_number text NOT NULL,  -- BẮT BUỘC: Số điện thoại
  full_name text,
  nickname text,  -- Tên hiển thị tài khoản (user tự đặt)
  stock_account_number text,  -- Số tài khoản chứng khoán (optional)
  avatar_url text,
  zalo_id text UNIQUE,
  membership text DEFAULT 'free' CHECK (membership IN ('free','premium')),
  membership_expires_at timestamptz,
  tcbs_api_key text,
  tcbs_connected_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT nickname_length_check CHECK (nickname IS NULL OR (char_length(nickname) >= 2 AND char_length(nickname) <= 50)),
  CONSTRAINT phone_format_check CHECK (phone_number ~ '^[0-9+\-\s()]{9,20}$')
);

-- Create signals table
CREATE TABLE IF NOT EXISTS public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  signal text CHECK (signal IN ('BUY','SELL','HOLD')),
  confidence numeric,
  created_at timestamptz DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON public.profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON public.profiles(membership);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SECTION 2: AUTH TRIGGERS
-- =====================================================

-- Function: Auto-create profile when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    phone_number,
    full_name,
    avatar_url,
    membership,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'temp_' || NEW.id || '@cpls.app'),
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', '0000000000'),  -- Default nếu không có
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'free',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- SECTION 4: HELPER FUNCTIONS
-- =====================================================

-- Function: Get current user's profile
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id uuid,
  email text,
  phone_number text,
  full_name text,
  nickname text,
  stock_account_number text,
  avatar_url text,
  zalo_id text,
  membership text,
  membership_expires_at timestamptz,
  tcbs_api_key text,
  tcbs_connected_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.phone_number,
    p.full_name,
    p.nickname,
    p.stock_account_number,
    p.avatar_url,
    p.zalo_id,
    p.membership,
    p.membership_expires_at,
    p.tcbs_api_key,
    p.tcbs_connected_at,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has premium membership
CREATE OR REPLACE FUNCTION public.is_premium_user()
RETURNS BOOLEAN AS $$
DECLARE
  user_profile RECORD;
BEGIN
  SELECT membership, membership_expires_at
  INTO user_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF user_profile.membership != 'premium' THEN
    RETURN FALSE;
  END IF;

  IF user_profile.membership_expires_at IS NOT NULL THEN
    RETURN user_profile.membership_expires_at > NOW();
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Link Zalo account to current user
CREATE OR REPLACE FUNCTION public.link_zalo_account(
  p_zalo_id text,
  p_full_name text DEFAULT NULL,
  p_nickname text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_phone_number text DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  v_profile public.profiles;
  v_existing_profile public.profiles;
BEGIN
  -- Kiểm tra xem Zalo ID đã được link với user khác chưa
  SELECT * INTO v_existing_profile
  FROM public.profiles
  WHERE zalo_id = p_zalo_id
  AND id != auth.uid();

  IF FOUND THEN
    RAISE EXCEPTION 'Zalo account already linked to another user';
  END IF;

  -- Update profile với Zalo data
  UPDATE public.profiles
  SET
    zalo_id = p_zalo_id,
    full_name = COALESCE(p_full_name, full_name),
    nickname = COALESCE(p_nickname, nickname),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    phone_number = COALESCE(p_phone_number, phone_number),
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update user profile (validates required fields)
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_phone_number text DEFAULT NULL,
  p_nickname text DEFAULT NULL,
  p_full_name text DEFAULT NULL,
  p_stock_account_number text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  -- Validate nickname length if provided
  IF p_nickname IS NOT NULL AND (char_length(p_nickname) < 2 OR char_length(p_nickname) > 50) THEN
    RAISE EXCEPTION 'Nickname must be between 2 and 50 characters';
  END IF;

  -- Validate phone number format if provided
  IF p_phone_number IS NOT NULL AND NOT (p_phone_number ~ '^[0-9+\-\s()]{9,20}$') THEN
    RAISE EXCEPTION 'Invalid phone number format';
  END IF;

  UPDATE public.profiles
  SET
    phone_number = COALESCE(p_phone_number, phone_number),
    nickname = COALESCE(p_nickname, nickname),
    full_name = COALESCE(p_full_name, full_name),
    stock_account_number = COALESCE(p_stock_account_number, stock_account_number),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update user nickname
CREATE OR REPLACE FUNCTION public.update_my_nickname(p_nickname text)
RETURNS public.profiles AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  -- Validate nickname length
  IF p_nickname IS NOT NULL AND (char_length(p_nickname) < 2 OR char_length(p_nickname) > 50) THEN
    RAISE EXCEPTION 'Nickname must be between 2 and 50 characters';
  END IF;

  UPDATE public.profiles
  SET
    nickname = p_nickname,
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get display name (nickname nếu có, ngược lại full_name)
CREATE OR REPLACE FUNCTION public.get_display_name(p_user_id uuid)
RETURNS text AS $$
DECLARE
  v_nickname text;
  v_full_name text;
BEGIN
  SELECT nickname, full_name INTO v_nickname, v_full_name
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 'Unknown User';
  END IF;

  -- Ưu tiên nickname, nếu không có thì dùng full_name
  RETURN COALESCE(v_nickname, v_full_name, 'Unknown User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Validate profile completeness
CREATE OR REPLACE FUNCTION public.is_profile_complete()
RETURNS BOOLEAN AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT email, phone_number, full_name
  INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check required fields
  RETURN (
    v_profile.email IS NOT NULL AND
    v_profile.phone_number IS NOT NULL AND
    v_profile.full_name IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 5: COMMENTS & DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.profiles IS 'User profiles with authentication and membership data';
COMMENT ON COLUMN public.profiles.email IS 'Email address (REQUIRED)';
COMMENT ON COLUMN public.profiles.phone_number IS 'Số điện thoại (BẮT BUỘC) - format: 9-20 ký tự, cho phép số, +, -, space, ()';
COMMENT ON COLUMN public.profiles.nickname IS 'Tên hiển thị tài khoản (user tự đặt), ưu tiên hiển thị thay vì full_name';
COMMENT ON COLUMN public.profiles.full_name IS 'Họ tên đầy đủ từ Zalo hoặc user nhập';
COMMENT ON COLUMN public.profiles.stock_account_number IS 'Số tài khoản chứng khoán (OPTIONAL)';
COMMENT ON COLUMN public.profiles.zalo_id IS 'Zalo user ID from OAuth, unique identifier';
COMMENT ON COLUMN public.profiles.membership IS 'Membership tier: free or premium';

COMMENT ON FUNCTION public.handle_new_user() IS 'Tự động tạo profile khi user mới đăng ký qua Supabase Auth';
COMMENT ON FUNCTION public.get_my_profile() IS 'Lấy profile của user hiện đang đăng nhập';
COMMENT ON FUNCTION public.is_premium_user() IS 'Kiểm tra xem user có premium membership còn hạn không';
COMMENT ON FUNCTION public.link_zalo_account(text, text, text, text, text) IS 'Link Zalo account với user hiện tại';
COMMENT ON FUNCTION public.update_my_profile(text, text, text, text, text) IS 'Cập nhật profile (validates phone_number và nickname)';
COMMENT ON FUNCTION public.update_my_nickname(text) IS 'Cập nhật nickname của user hiện tại';
COMMENT ON FUNCTION public.get_display_name(uuid) IS 'Lấy tên hiển thị (ưu tiên nickname, fallback full_name)';
COMMENT ON FUNCTION public.is_profile_complete() IS 'Kiểm tra xem profile đã điền đủ thông tin bắt buộc chưa (email, phone, full_name)';

-- =====================================================
-- SECTION 6: PERMISSIONS & ACCESS CONTROL
-- =====================================================

-- Function: Check if user can access a feature
CREATE OR REPLACE FUNCTION public.can_access_feature(p_feature text)
RETURNS BOOLEAN AS $$
DECLARE
  v_membership text;
  v_expires_at timestamptz;
BEGIN
  -- Get user membership
  SELECT membership, membership_expires_at
  INTO v_membership, v_expires_at
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Premium users can access everything
  IF v_membership = 'premium' THEN
    -- Check if premium is not expired
    IF v_expires_at IS NULL OR v_expires_at > NOW() THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Free users can only access certain features
  -- Allowed features for Free: 'dashboard', 'stocks', 'market', 'profile'
  IF p_feature IN ('dashboard', 'stocks', 'market', 'profile') THEN
    RETURN TRUE;
  END IF;

  -- Default: no access
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get list of accessible features for current user
CREATE OR REPLACE FUNCTION public.get_my_accessible_features()
RETURNS TABLE (
  feature text,
  is_premium_only boolean
) AS $$
DECLARE
  v_is_premium boolean;
BEGIN
  -- Check if user has premium
  v_is_premium := public.is_premium_user();

  -- Return all features with access status
  RETURN QUERY
  SELECT 'dashboard'::text AS feature, FALSE AS is_premium_only
  UNION ALL
  SELECT 'stocks'::text, FALSE
  UNION ALL
  SELECT 'market'::text, FALSE
  UNION ALL
  SELECT 'profile'::text, FALSE
  UNION ALL
  SELECT 'signals'::text, TRUE
  UNION ALL
  SELECT 'ai-analysis'::text, TRUE
  UNION ALL
  SELECT 'portfolio'::text, TRUE
  UNION ALL
  SELECT 'alerts'::text, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Require premium membership (raises exception if not premium)
CREATE OR REPLACE FUNCTION public.require_premium()
RETURNS void AS $$
BEGIN
  IF NOT public.is_premium_user() THEN
    RAISE EXCEPTION 'This feature requires Premium membership. Please upgrade your account.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 7: COMMENTS FOR PERMISSIONS
-- =====================================================

COMMENT ON FUNCTION public.can_access_feature(text) IS 'Kiểm tra xem user có quyền truy cập feature không. Free: dashboard, stocks, market, profile. Premium: all';
COMMENT ON FUNCTION public.get_my_accessible_features() IS 'Lấy danh sách features mà user hiện tại có quyền truy cập';
COMMENT ON FUNCTION public.require_premium() IS 'Throws exception nếu user không phải premium - dùng trong stored procedures';

-- =====================================================
-- ✅ SETUP COMPLETE!
-- =====================================================
--
-- Required fields:
-- - email (text, NOT NULL, unique)
-- - phone_number (text, NOT NULL, format: 9-20 chars)
--
-- Optional fields:
-- - full_name, nickname, stock_account_number, avatar_url
--
-- Functions available:
--
-- Profile Management:
-- - get_my_profile()                           → Lấy profile hiện tại
-- - update_my_profile(...)                     → Cập nhật profile (có validation)
-- - update_my_nickname(nickname)               → Cập nhật nickname
-- - is_profile_complete()                      → Kiểm tra profile đã đủ thông tin
-- - get_display_name(user_id)                  → Lấy tên hiển thị
--
-- Authentication & Membership:
-- - is_premium_user()                          → Kiểm tra premium
-- - link_zalo_account(...)                     → Link Zalo với user
--
-- Permissions & Access Control:
-- - can_access_feature(feature)                → Kiểm tra quyền truy cập feature
-- - get_my_accessible_features()               → Lấy danh sách features có quyền
-- - require_premium()                          → Throw exception nếu không premium
--
-- Free tier access: 'dashboard', 'stocks', 'market', 'profile'
-- Premium tier access: ALL features (including 'signals', 'ai-analysis', 'portfolio', 'alerts')
--
-- =====================================================
