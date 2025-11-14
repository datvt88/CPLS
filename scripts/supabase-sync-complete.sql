-- =====================================================
-- SUPABASE COMPLETE SYNC SCRIPT - CPLS
-- =====================================================
-- Script đồng bộ đầy đủ cho Supabase
-- Bao gồm: Auth, Profile, Permissions
-- Copy toàn bộ script này vào Supabase SQL Editor và Run
--
-- Version: 1.0
-- Date: 2025-11-14
-- =====================================================

-- =====================================================
-- STEP 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- STEP 2: CREATE TABLES
-- =====================================================

-- Profiles Table
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

-- Signals Table
CREATE TABLE IF NOT EXISTS public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  signal text CHECK (signal IN ('BUY','SELL','HOLD')),
  confidence numeric,
  created_at timestamptz DEFAULT NOW()
);

-- =====================================================
-- STEP 3: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON public.profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON public.profiles(membership);

-- =====================================================
-- STEP 4: BASIC FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 5: AUTH TRIGGERS
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
    COALESCE(NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', '0000000000'),
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
-- STEP 6: ROW LEVEL SECURITY (RLS)
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
-- STEP 7: PROFILE MANAGEMENT FUNCTIONS
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
  SELECT * INTO v_existing_profile
  FROM public.profiles
  WHERE zalo_id = p_zalo_id
  AND id != auth.uid();

  IF FOUND THEN
    RAISE EXCEPTION 'Zalo account already linked to another user';
  END IF;

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
  IF p_nickname IS NOT NULL AND (char_length(p_nickname) < 2 OR char_length(p_nickname) > 50) THEN
    RAISE EXCEPTION 'Nickname must be between 2 and 50 characters';
  END IF;

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

-- Function: Get display name (nickname > full_name)
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

  RETURN (
    v_profile.email IS NOT NULL AND
    v_profile.phone_number IS NOT NULL AND
    v_profile.full_name IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 8: PERMISSIONS & ACCESS CONTROL
-- =====================================================

-- Function: Check if user can access a feature
CREATE OR REPLACE FUNCTION public.can_access_feature(p_feature text)
RETURNS BOOLEAN AS $$
DECLARE
  v_membership text;
  v_expires_at timestamptz;
BEGIN
  SELECT membership, membership_expires_at
  INTO v_membership, v_expires_at
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Premium users can access everything
  IF v_membership = 'premium' THEN
    IF v_expires_at IS NULL OR v_expires_at > NOW() THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Free users can only access certain features
  IF p_feature IN ('dashboard', 'stocks', 'market', 'profile') THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get list of accessible features for current user
CREATE OR REPLACE FUNCTION public.get_my_accessible_features()
RETURNS TABLE (
  feature text,
  is_premium_only boolean
) AS $$
BEGIN
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

-- Function: Require premium membership
CREATE OR REPLACE FUNCTION public.require_premium()
RETURNS void AS $$
BEGIN
  IF NOT public.is_premium_user() THEN
    RAISE EXCEPTION 'This feature requires Premium membership. Please upgrade your account.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 9: COMMENTS & DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.profiles IS 'User profiles with authentication and membership data';
COMMENT ON COLUMN public.profiles.email IS 'Email address (REQUIRED)';
COMMENT ON COLUMN public.profiles.phone_number IS 'Số điện thoại (BẮT BUỘC) - format: 9-20 ký tự';
COMMENT ON COLUMN public.profiles.nickname IS 'Tên hiển thị tài khoản (user tự đặt)';
COMMENT ON COLUMN public.profiles.full_name IS 'Họ tên đầy đủ từ Zalo hoặc user nhập';
COMMENT ON COLUMN public.profiles.stock_account_number IS 'Số tài khoản chứng khoán (OPTIONAL)';
COMMENT ON COLUMN public.profiles.zalo_id IS 'Zalo user ID from OAuth';
COMMENT ON COLUMN public.profiles.membership IS 'Membership tier: free or premium';

COMMENT ON FUNCTION public.handle_new_user() IS 'Tự động tạo profile khi user đăng ký';
COMMENT ON FUNCTION public.get_my_profile() IS 'Lấy profile của user hiện tại';
COMMENT ON FUNCTION public.is_premium_user() IS 'Kiểm tra premium membership';
COMMENT ON FUNCTION public.link_zalo_account(text, text, text, text, text) IS 'Link Zalo account với user';
COMMENT ON FUNCTION public.update_my_profile(text, text, text, text, text) IS 'Cập nhật profile với validation';
COMMENT ON FUNCTION public.update_my_nickname(text) IS 'Cập nhật nickname';
COMMENT ON FUNCTION public.get_display_name(uuid) IS 'Lấy tên hiển thị (ưu tiên nickname)';
COMMENT ON FUNCTION public.is_profile_complete() IS 'Kiểm tra profile đã đủ thông tin';
COMMENT ON FUNCTION public.can_access_feature(text) IS 'Kiểm tra quyền truy cập feature';
COMMENT ON FUNCTION public.get_my_accessible_features() IS 'Lấy danh sách features có quyền truy cập';
COMMENT ON FUNCTION public.require_premium() IS 'Throw exception nếu không premium';

-- =====================================================
-- ✅ SETUP COMPLETE!
-- =====================================================
--
-- DATABASE SCHEMA:
-- ✅ profiles table (email, phone_number required)
-- ✅ signals table
--
-- AUTHENTICATION:
-- ✅ Auto-create profile trigger
-- ✅ RLS policies
-- ✅ Zalo OAuth integration
--
-- PROFILE MANAGEMENT (10 functions):
-- ✅ get_my_profile()
-- ✅ update_my_profile(phone, nickname, full_name, stock_account, avatar)
-- ✅ update_my_nickname(nickname)
-- ✅ is_profile_complete()
-- ✅ get_display_name(user_id)
-- ✅ is_premium_user()
-- ✅ link_zalo_account(zalo_id, full_name, nickname, avatar, phone)
--
-- PERMISSIONS (3 functions):
-- ✅ can_access_feature(feature)
-- ✅ get_my_accessible_features()
-- ✅ require_premium()
--
-- FREE TIER ACCESS:
-- - Tổng quan (dashboard)
-- - Cổ phiếu (stocks)
-- - Thị trường (market)
-- - Cá nhân (profile)
--
-- PREMIUM TIER ACCESS:
-- - All Free features +
-- - Tín hiệu (signals)
-- - Phân tích AI (ai-analysis)
-- - Danh mục (portfolio)
-- - Cảnh báo (alerts)
--
-- NEXT STEPS:
-- 1. Copy script này vào Supabase SQL Editor
-- 2. Click "Run" để thực thi
-- 3. Verify: SELECT * FROM get_my_accessible_features();
-- 4. Test đăng ký/đăng nhập Zalo
-- 5. Test phân quyền Free/Premium
--
-- =====================================================
