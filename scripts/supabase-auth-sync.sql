-- =====================================================
-- SUPABASE AUTHENTICATION & PROFILE SYNC SCRIPTS
-- =====================================================
-- Các script này đồng bộ hóa tạo tài khoản, đăng nhập và xác thực
-- với Zalo OAuth và Supabase Authentication
-- =====================================================

-- =====================================================
-- 1. TRIGGERS: Tự động tạo profile khi user đăng ký
-- =====================================================

-- Function: Tạo profile tự động khi user mới được tạo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    membership,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'free',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Kích hoạt khi user mới được tạo trong auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Bật RLS cho bảng profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: User chỉ có thể đọc profile của chính mình
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: User chỉ có thể cập nhật profile của chính mình
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: User có thể insert profile của chính mình (backup cho trigger)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Admin có thể xem tất cả profiles (optional)
-- Bỏ comment nếu cần role admin
-- DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
-- CREATE POLICY "Admins can view all profiles"
--   ON public.profiles
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM auth.users
--       WHERE auth.users.id = auth.uid()
--       AND auth.users.raw_user_meta_data->>'role' = 'admin'
--     )
--   );

-- =====================================================
-- 3. HELPER FUNCTIONS: Xác thực và quản lý user
-- =====================================================

-- Function: Lấy profile của user hiện tại
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  nickname text,
  phone_number text,
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
    p.full_name,
    p.nickname,
    p.phone_number,
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

-- Function: Kiểm tra xem user có premium membership không
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

  -- Nếu có expiration date, kiểm tra xem còn hạn không
  IF user_profile.membership_expires_at IS NOT NULL THEN
    RETURN user_profile.membership_expires_at > NOW();
  END IF;

  -- Nếu không có expiration date, coi như lifetime premium
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Link Zalo account với existing user
CREATE OR REPLACE FUNCTION public.link_zalo_account(
  p_zalo_id text,
  p_full_name text DEFAULT NULL,
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
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    phone_number = COALESCE(p_phone_number, phone_number),
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Tìm hoặc tạo user với Zalo ID
CREATE OR REPLACE FUNCTION public.find_or_create_user_by_zalo(
  p_zalo_id text,
  p_email text,
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  -- Tìm user có Zalo ID này
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE zalo_id = p_zalo_id
  LIMIT 1;

  IF FOUND THEN
    -- Update thông tin từ Zalo
    UPDATE public.profiles
    SET
      full_name = COALESCE(p_full_name, full_name),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = NOW()
    WHERE id = v_profile.id
    RETURNING * INTO v_profile;
  ELSE
    -- Tạo profile mới
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      avatar_url,
      zalo_id,
      membership,
      created_at
    )
    VALUES (
      auth.uid(),
      p_email,
      p_full_name,
      p_avatar_url,
      p_zalo_id,
      'free',
      NOW()
    )
    RETURNING * INTO v_profile;
  END IF;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. INDEXES: Tối ưu hóa truy vấn
-- =====================================================

-- Index đã được tạo trong schema.sql, đảm bảo chúng tồn tại:
CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON public.profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON public.profiles(nickname);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON public.profiles(membership);

-- =====================================================
-- 5. COMMENTS: Documentation cho database
-- =====================================================

COMMENT ON FUNCTION public.handle_new_user() IS 'Tự động tạo profile khi user mới đăng ký qua Supabase Auth';
COMMENT ON FUNCTION public.get_my_profile() IS 'Lấy profile của user hiện đang đăng nhập';
COMMENT ON FUNCTION public.is_premium_user() IS 'Kiểm tra xem user có premium membership còn hạn không';
COMMENT ON FUNCTION public.link_zalo_account(text, text, text, text) IS 'Link Zalo account với user hiện tại';
COMMENT ON FUNCTION public.find_or_create_user_by_zalo(text, text, text, text) IS 'Tìm hoặc tạo user dựa trên Zalo ID';

COMMENT ON COLUMN public.profiles.nickname IS 'Tên hiển thị trong chat rooms, có thể khác với full_name';
COMMENT ON COLUMN public.profiles.zalo_id IS 'Zalo user ID từ OAuth, unique identifier từ Zalo';
COMMENT ON COLUMN public.profiles.membership IS 'Loại membership: free hoặc premium';

-- =====================================================
-- HOÀN THÀNH!
-- =====================================================
-- Để áp dụng scripts này vào Supabase:
-- 1. Mở Supabase Dashboard > SQL Editor
-- 2. Tạo new query và paste toàn bộ script này
-- 3. Chạy script để tạo triggers, policies, và functions
-- 4. Test bằng cách đăng ký user mới và kiểm tra profiles table
-- =====================================================
