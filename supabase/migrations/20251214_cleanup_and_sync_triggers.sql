-- ============================================================================
-- Migration: Cleanup Old Triggers and Create Synchronized Auth Triggers
-- Created: 2025-12-14
-- Purpose: 
--   1. Xóa sạch các Trigger cũ có thể gây lỗi đăng nhập/xác thực
--   2. Tạo lại Trigger mới đồng bộ cho việc đăng nhập và xác thực
-- 
-- Usage: Copy toàn bộ script này và chạy trong Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PHẦN 1: XÓA SẠCH CÁC TRIGGER VÀ FUNCTION CŨ CÓ THỂ GÂY LỖI
-- ============================================================================

-- 1.1 Xóa tất cả triggers trên bảng profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_change ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
DROP TRIGGER IF EXISTS trigger_update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_timestamp ON public.profiles;

-- 1.2 Xóa tất cả triggers trên auth.users (nếu có quyền)
-- LƯU Ý: Một số triggers trên auth.users cần quyền superuser
DO $$
BEGIN
  -- Xóa các triggers phổ biến có thể tồn tại trên auth.users
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
  DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;
  DROP TRIGGER IF EXISTS create_user_profile ON auth.users;
  DROP TRIGGER IF EXISTS sync_user_profile ON auth.users;
  DROP TRIGGER IF EXISTS trigger_create_profile ON auth.users;
  DROP TRIGGER IF EXISTS after_auth_user_insert ON auth.users;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Không đủ quyền để xóa triggers trên auth.users - bỏ qua';
  WHEN OTHERS THEN
    RAISE NOTICE 'Lỗi khi xóa triggers trên auth.users: %', SQLERRM;
END;
$$;

-- 1.3 Xóa tất cả triggers trên user_devices (nếu có)
DROP TRIGGER IF EXISTS update_user_devices_updated_at ON public.user_devices;
DROP TRIGGER IF EXISTS on_device_change ON public.user_devices;

-- 1.4 Xóa các functions cũ có thể conflict
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_on_signup() CASCADE;
DROP FUNCTION IF EXISTS public.sync_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.notify_profile_change() CASCADE;
DROP FUNCTION IF EXISTS public.on_auth_user_created() CASCADE;

-- Thông báo hoàn thành phần 1
DO $$ BEGIN RAISE NOTICE '✅ PHẦN 1: Đã xóa sạch các triggers và functions cũ'; END; $$;

-- ============================================================================
-- PHẦN 2: TẠO CÁC HELPER FUNCTIONS
-- ============================================================================

-- 2.1 Function cập nhật updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 Function tạo profile tự động khi user đăng ký
-- Được gọi bởi trigger khi có user mới trong auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  user_phone TEXT;
  user_full_name TEXT;
  user_avatar TEXT;
  user_provider TEXT;
  -- Số điện thoại placeholder khi không có thông tin
  DEFAULT_PHONE_PLACEHOLDER CONSTANT TEXT := 'PENDING_PHONE';
BEGIN
  -- Lấy thông tin từ user metadata
  user_email := COALESCE(NEW.email, '');
  user_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone_number',
    NEW.raw_user_meta_data->>'phone',
    NEW.phone,
    ''
  );
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  user_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  );
  user_provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'email'
  );

  -- Tạo profile nếu chưa tồn tại
  INSERT INTO public.profiles (
    id,
    email,
    phone_number,
    full_name,
    avatar_url,
    role,
    membership,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    user_email,
    CASE WHEN user_phone = '' THEN DEFAULT_PHONE_PLACEHOLDER ELSE user_phone END,
    user_full_name,
    user_avatar,
    'user',
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.profiles.avatar_url),
    updated_at = NOW();

  -- Log sự kiện tạo user mới
  RAISE NOTICE 'Profile created/updated for user: % (email: %, provider: %)', 
    NEW.id, user_email, user_provider;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log lỗi nhưng không block user signup
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.3 Function thông báo khi profile thay đổi (cho Custom Claims refresh)
CREATE OR REPLACE FUNCTION public.notify_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Log thay đổi để monitoring
  IF OLD.role IS DISTINCT FROM NEW.role 
     OR OLD.membership IS DISTINCT FROM NEW.membership 
     OR OLD.membership_expires_at IS DISTINCT FROM NEW.membership_expires_at THEN
    RAISE NOTICE 'Profile updated for user %: role=% -> %, membership=% -> %', 
      NEW.id, OLD.role, NEW.role, OLD.membership, NEW.membership;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo hoàn thành phần 2
DO $$ BEGIN RAISE NOTICE '✅ PHẦN 2: Đã tạo các helper functions'; END; $$;

-- ============================================================================
-- PHẦN 3: TẠO CÁC TRIGGERS MỚI ĐỒNG BỘ
-- ============================================================================

-- 3.1 Trigger tự động cập nhật updated_at khi update profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3.2 Trigger thông báo khi role/membership thay đổi
CREATE TRIGGER on_profile_change
  AFTER UPDATE OF role, membership, membership_expires_at
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_profile_change();

-- 3.3 Trigger tạo profile tự động khi user đăng ký mới
-- LƯU Ý: Cần quyền để tạo trigger trên auth.users
DO $$
BEGIN
  -- Tạo trigger trên auth.users
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
    
  RAISE NOTICE '✅ Đã tạo trigger on_auth_user_created trên auth.users';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '⚠️ Không đủ quyền để tạo trigger trên auth.users';
    RAISE NOTICE 'Bạn cần chạy lệnh sau với quyền superuser:';
    RAISE NOTICE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  WHEN duplicate_object THEN
    RAISE NOTICE '⚠️ Trigger on_auth_user_created đã tồn tại';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Lỗi khi tạo trigger: %', SQLERRM;
END;
$$;

-- Thông báo hoàn thành phần 3
DO $$ BEGIN RAISE NOTICE '✅ PHẦN 3: Đã tạo các triggers mới'; END; $$;

-- ============================================================================
-- PHẦN 4: CẬP NHẬT/TẠO MỚI CUSTOM ACCESS TOKEN HOOK
-- ============================================================================

-- 4.1 Function lấy user claims từ profiles (cho JWT)
CREATE OR REPLACE FUNCTION public.get_user_claims(user_id UUID)
RETURNS JSONB AS $$
DECLARE
  user_profile RECORD;
  is_premium BOOLEAN;
BEGIN
  -- Lấy thông tin profile
  SELECT 
    role,
    membership,
    membership_expires_at
  INTO user_profile
  FROM public.profiles
  WHERE id = user_id;

  -- Nếu không có profile, trả về claims mặc định
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'role', 'user',
      'membership', 'free',
      'is_premium', false
    );
  END IF;

  -- Kiểm tra trạng thái premium
  is_premium := user_profile.membership = 'premium' 
    AND (user_profile.membership_expires_at IS NULL 
         OR user_profile.membership_expires_at > NOW());

  -- Trả về claims
  RETURN jsonb_build_object(
    'role', COALESCE(user_profile.role, 'user'),
    'membership', COALESCE(user_profile.membership, 'free'),
    'is_premium', is_premium
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 Custom Access Token Hook
-- Function này được Supabase Auth gọi khi tạo JWT token
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  user_id UUID;
  current_app_metadata JSONB;
BEGIN
  -- Lấy user ID từ event
  user_id := (event->>'user_id')::UUID;
  
  -- Lấy claims cho user này
  claims := public.get_user_claims(user_id);
  
  -- Lấy app_metadata hiện tại hoặc tạo object rỗng
  current_app_metadata := COALESCE(event->'claims'->'app_metadata', '{}'::jsonb);
  
  -- Merge claims vào app_metadata
  -- Điều này đảm bảo claims accessible tại session.user.app_metadata
  current_app_metadata := current_app_metadata || claims;
  
  -- Cập nhật event với app_metadata mới
  event := jsonb_set(event, '{claims,app_metadata}', current_app_metadata);
  
  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- Nếu có lỗi, trả về event gốc không thay đổi
    RAISE WARNING 'Error in custom_access_token_hook: %', SQLERRM;
    RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Thông báo hoàn thành phần 4
DO $$ BEGIN RAISE NOTICE '✅ PHẦN 4: Đã cập nhật Custom Access Token Hook'; END; $$;

-- ============================================================================
-- PHẦN 5: CẤP QUYỀN CHO CÁC FUNCTIONS
-- ============================================================================

-- 5.1 Quyền cho các helper functions
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

GRANT EXECUTE ON FUNCTION public.notify_profile_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_profile_change() TO service_role;

-- 5.2 Quyền cho JWT claims functions
GRANT EXECUTE ON FUNCTION public.get_user_claims(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_claims(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;

-- Thông báo hoàn thành phần 5
DO $$ BEGIN RAISE NOTICE '✅ PHẦN 5: Đã cấp quyền cho các functions'; END; $$;

-- ============================================================================
-- PHẦN 6: ĐẢM BẢO CẤU TRÚC BẢNG PROFILES ĐẦY ĐỦ
-- ============================================================================

-- 6.1 Thêm cột role nếu chưa có
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles 
    ADD COLUMN role TEXT DEFAULT 'user' 
    CHECK (role IN ('user', 'mod', 'admin'));
    RAISE NOTICE 'Đã thêm cột role vào profiles';
  ELSE
    RAISE NOTICE 'Cột role đã tồn tại trong profiles';
  END IF;
END $$;

-- 6.2 Tạo index cho role nếu chưa có
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 6.3 Tạo index cho membership nếu chưa có
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON public.profiles(membership);

-- 6.4 Tạo index cho membership_expires_at nếu chưa có
CREATE INDEX IF NOT EXISTS idx_profiles_membership_expires_at ON public.profiles(membership_expires_at);

-- Thông báo hoàn thành phần 6
DO $$ BEGIN RAISE NOTICE '✅ PHẦN 6: Đã đảm bảo cấu trúc bảng profiles'; END; $$;

-- ============================================================================
-- PHẦN 7: TẠO CÁC RPC FUNCTIONS TIỆN ÍCH
-- ============================================================================

-- 7.1 Function lấy profile của user hiện tại
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.profiles
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.2 Function kiểm tra user có phải premium không
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

  RETURN user_profile.membership = 'premium' 
    AND (user_profile.membership_expires_at IS NULL 
         OR user_profile.membership_expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.3 Function link Zalo account
CREATE OR REPLACE FUNCTION public.link_zalo_account(
  p_zalo_id TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  current_user_id UUID;
  zalo_linked_profile public.profiles;
BEGIN
  -- Kiểm tra user đã đăng nhập
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để thực hiện thao tác này';
  END IF;

  -- Validate Zalo ID không được rỗng
  IF p_zalo_id IS NULL OR char_length(trim(p_zalo_id)) = 0 THEN
    RAISE EXCEPTION 'Zalo ID không được để trống';
  END IF;

  UPDATE public.profiles
  SET
    zalo_id = p_zalo_id,
    full_name = COALESCE(p_full_name, full_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    phone_number = COALESCE(p_phone_number, phone_number),
    updated_at = NOW()
  WHERE id = current_user_id
  RETURNING * INTO zalo_linked_profile;

  IF zalo_linked_profile IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy profile của bạn';
  END IF;

  RETURN zalo_linked_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.4 Function cập nhật nickname
-- Giới hạn: 2-50 ký tự
CREATE OR REPLACE FUNCTION public.update_my_nickname(p_nickname TEXT)
RETURNS public.profiles AS $$
DECLARE
  current_user_id UUID;
  nickname_updated_profile public.profiles;
  MIN_NICKNAME_LENGTH CONSTANT INT := 2;
  MAX_NICKNAME_LENGTH CONSTANT INT := 50;
BEGIN
  -- Kiểm tra user đã đăng nhập
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập để thực hiện thao tác này';
  END IF;

  -- Validate nickname length
  IF p_nickname IS NOT NULL AND (char_length(p_nickname) < MIN_NICKNAME_LENGTH OR char_length(p_nickname) > MAX_NICKNAME_LENGTH) THEN
    RAISE EXCEPTION 'Nickname phải từ %-% ký tự', MIN_NICKNAME_LENGTH, MAX_NICKNAME_LENGTH;
  END IF;

  UPDATE public.profiles
  SET
    nickname = p_nickname,
    updated_at = NOW()
  WHERE id = current_user_id
  RETURNING * INTO nickname_updated_profile;

  IF nickname_updated_profile IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy profile của bạn';
  END IF;

  RETURN nickname_updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7.5 Function lấy tên hiển thị
CREATE OR REPLACE FUNCTION public.get_display_name(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  result_display_name TEXT;
BEGIN
  -- Cho phép gọi cả khi không đăng nhập (dùng để hiển thị tên public)
  IF p_user_id IS NULL THEN
    RETURN 'Unknown User';
  END IF;

  SELECT COALESCE(nickname, full_name, 'Unknown User')
  INTO result_display_name
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN COALESCE(result_display_name, 'Unknown User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cấp quyền cho các RPC functions
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_premium_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_zalo_account(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_nickname(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_display_name(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_display_name(UUID) TO anon;

-- Thông báo hoàn thành phần 7
DO $$ BEGIN RAISE NOTICE '✅ PHẦN 7: Đã tạo các RPC functions tiện ích'; END; $$;

-- ============================================================================
-- PHẦN 8: KIỂM TRA VÀ BÁO CÁO
-- ============================================================================

-- Liệt kê tất cả triggers hiện có trên profiles
DO $$
DECLARE
  trigger_rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===============================================';
  RAISE NOTICE 'BÁO CÁO TRIGGERS HIỆN TẠI TRÊN BẢNG PROFILES:';
  RAISE NOTICE '===============================================';
  
  FOR trigger_rec IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'public.profiles'::regclass 
    AND tgisinternal = false
  LOOP
    RAISE NOTICE '  ✓ %', trigger_rec.tgname;
  END LOOP;
  
  RAISE NOTICE '';
END;
$$;

-- Liệt kê tất cả functions đã tạo
DO $$
BEGIN
  RAISE NOTICE '===============================================';
  RAISE NOTICE 'CÁC FUNCTIONS ĐÃ TẠO/CẬP NHẬT:';
  RAISE NOTICE '===============================================';
  RAISE NOTICE '  ✓ update_updated_at_column()';
  RAISE NOTICE '  ✓ handle_new_user()';
  RAISE NOTICE '  ✓ notify_profile_change()';
  RAISE NOTICE '  ✓ get_user_claims(UUID)';
  RAISE NOTICE '  ✓ custom_access_token_hook(JSONB)';
  RAISE NOTICE '  ✓ get_my_profile()';
  RAISE NOTICE '  ✓ is_premium_user()';
  RAISE NOTICE '  ✓ link_zalo_account(...)';
  RAISE NOTICE '  ✓ update_my_nickname(TEXT)';
  RAISE NOTICE '  ✓ get_display_name(UUID)';
  RAISE NOTICE '';
END;
$$;

-- ============================================================================
-- HOÀN THÀNH
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION HOÀN THÀNH THÀNH CÔNG!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'CÁC BƯỚC TIẾP THEO:';
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  Kiểm tra trigger trên auth.users (nếu chưa tạo được):';
  RAISE NOTICE '    SELECT * FROM pg_trigger WHERE tgrelid = ''auth.users''::regclass;';
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  Cấu hình Custom Access Token Hook (yêu cầu Supabase Pro):';
  RAISE NOTICE '    - Vào Dashboard → Authentication → Hooks';
  RAISE NOTICE '    - Enable "Custom access token" hook';
  RAISE NOTICE '    - Chọn function: custom_access_token_hook';
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  Test đăng ký/đăng nhập để xác nhận triggers hoạt động';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END;
$$;
