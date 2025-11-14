-- =====================================================
-- SUPABASE ALL-IN-ONE SETUP SCRIPT
-- =====================================================
-- Script này gom tất cả migrations và setup cho CPLS
-- Chỉ cần copy-paste vào Supabase SQL Editor và Run 1 lần
--
-- Bao gồm:
-- 1. Base schema (profiles, signals tables)
-- 2. Nickname field cho chat
-- 3. Auth triggers & RLS policies
-- 4. Chat tables (rooms, members, messages)
-- 5. Helper functions
-- =====================================================

-- =====================================================
-- SECTION 1: BASE SCHEMA
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  nickname text,  -- Display name for chat rooms and real-time messaging
  phone_number text,
  stock_account_number text,
  avatar_url text,
  zalo_id text UNIQUE,
  membership text DEFAULT 'free' CHECK (membership IN ('free','premium')),
  membership_expires_at timestamptz,
  tcbs_api_key text,
  tcbs_connected_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT nickname_length_check CHECK (nickname IS NULL OR (char_length(nickname) >= 2 AND char_length(nickname) <= 50))
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
-- SECTION 2: AUTH TRIGGERS & RLS POLICIES
-- =====================================================

-- Function: Auto-create profile when new user signs up
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

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- RLS Policy: Users can update own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can insert own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- SECTION 3: HELPER FUNCTIONS FOR AUTH & PROFILE
-- =====================================================

-- Function: Get current user's profile
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
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    phone_number = COALESCE(p_phone_number, phone_number),
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Find or create user by Zalo ID
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
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE zalo_id = p_zalo_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.profiles
    SET
      full_name = COALESCE(p_full_name, full_name),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = NOW()
    WHERE id = v_profile.id
    RETURNING * INTO v_profile;
  ELSE
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
-- SECTION 4: CHAT TABLES
-- =====================================================

-- Table: chat_rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  room_type text NOT NULL DEFAULT 'group' CHECK (room_type IN ('direct', 'group', 'public')),
  avatar_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  is_active boolean DEFAULT true
);

-- Indexes for chat_rooms
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON public.chat_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON public.chat_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_active ON public.chat_rooms(is_active);

-- Table: room_members
CREATE TABLE IF NOT EXISTS public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT NOW(),
  last_read_at timestamptz DEFAULT NOW(),
  is_muted boolean DEFAULT false,
  UNIQUE(room_id, user_id)
);

-- Indexes for room_members
CREATE INDEX IF NOT EXISTS idx_room_members_room ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_role ON public.room_members(role);

-- Table: messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  metadata jsonb DEFAULT '{}'::jsonb,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_room ON public.messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to);

-- Triggers for chat tables
DROP TRIGGER IF EXISTS update_chat_rooms_updated_at ON public.chat_rooms;
CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SECTION 5: RLS POLICIES FOR CHAT TABLES
-- =====================================================

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Chat Rooms Policies
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
CREATE POLICY "Users can view rooms they are members of"
  ON public.chat_rooms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_members.room_id = chat_rooms.id
      AND room_members.user_id = auth.uid()
    )
    OR room_type = 'public'
  );

DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
CREATE POLICY "Users can create rooms"
  ON public.chat_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Room owners and admins can update rooms" ON public.chat_rooms;
CREATE POLICY "Room owners and admins can update rooms"
  ON public.chat_rooms
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_members.room_id = chat_rooms.id
      AND room_members.user_id = auth.uid()
      AND room_members.role IN ('owner', 'admin')
    )
  );

-- Room Members Policies
DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.room_members;
CREATE POLICY "Users can view members of their rooms"
  ON public.room_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_members.room_id
      AND rm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can join rooms" ON public.room_members;
CREATE POLICY "Users can join rooms"
  ON public.room_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own membership" ON public.room_members;
CREATE POLICY "Users can update own membership"
  ON public.room_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Room owners and admins can manage members" ON public.room_members;
CREATE POLICY "Room owners and admins can manage members"
  ON public.room_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = room_members.room_id
      AND rm.user_id = auth.uid()
      AND rm.role IN ('owner', 'admin')
    )
  );

-- Messages Policies
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
CREATE POLICY "Users can view messages in their rooms"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_members.room_id = messages.room_id
      AND room_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages to their rooms" ON public.messages;
CREATE POLICY "Users can send messages to their rooms"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_members.room_id = messages.room_id
      AND room_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- =====================================================
-- SECTION 6: CHAT HELPER FUNCTIONS
-- =====================================================

-- Function: Create direct chat between 2 users
CREATE OR REPLACE FUNCTION public.create_direct_chat(
  p_other_user_id uuid,
  p_room_name text DEFAULT NULL
)
RETURNS public.chat_rooms AS $$
DECLARE
  v_room public.chat_rooms;
  v_existing_room public.chat_rooms;
BEGIN
  SELECT cr.* INTO v_existing_room
  FROM public.chat_rooms cr
  WHERE cr.room_type = 'direct'
  AND EXISTS (
    SELECT 1 FROM public.room_members rm1
    WHERE rm1.room_id = cr.id AND rm1.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.room_members rm2
    WHERE rm2.room_id = cr.id AND rm2.user_id = p_other_user_id
  )
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing_room;
  END IF;

  INSERT INTO public.chat_rooms (name, room_type, created_by)
  VALUES (
    COALESCE(p_room_name, 'Direct Chat'),
    'direct',
    auth.uid()
  )
  RETURNING * INTO v_room;

  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES
    (v_room.id, auth.uid(), 'owner'),
    (v_room.id, p_other_user_id, 'member');

  RETURN v_room;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Count unread messages in a room
CREATE OR REPLACE FUNCTION public.count_unread_messages(p_room_id uuid)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_last_read_at timestamptz;
BEGIN
  SELECT last_read_at INTO v_last_read_at
  FROM public.room_members
  WHERE room_id = p_room_id
  AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.messages
  WHERE room_id = p_room_id
  AND created_at > v_last_read_at
  AND sender_id != auth.uid()
  AND is_deleted = false;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark room as read
CREATE OR REPLACE FUNCTION public.mark_room_as_read(p_room_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.room_members
  SET last_read_at = NOW()
  WHERE room_id = p_room_id
  AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's rooms with metadata
CREATE OR REPLACE FUNCTION public.get_my_rooms()
RETURNS TABLE (
  room_id uuid,
  room_name text,
  room_type text,
  avatar_url text,
  last_message_content text,
  last_message_at timestamptz,
  unread_count integer,
  member_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cr.id AS room_id,
    cr.name AS room_name,
    cr.room_type,
    cr.avatar_url,
    (
      SELECT m.content
      FROM public.messages m
      WHERE m.room_id = cr.id
      AND m.is_deleted = false
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS last_message_content,
    (
      SELECT m.created_at
      FROM public.messages m
      WHERE m.room_id = cr.id
      AND m.is_deleted = false
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS last_message_at,
    public.count_unread_messages(cr.id) AS unread_count,
    (
      SELECT COUNT(*)
      FROM public.room_members
      WHERE room_id = cr.id
    ) AS member_count
  FROM public.chat_rooms cr
  INNER JOIN public.room_members rm ON rm.room_id = cr.id
  WHERE rm.user_id = auth.uid()
  AND cr.is_active = true
  ORDER BY last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SECTION 7: COMMENTS & DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.profiles IS 'User profiles with authentication and membership data';
COMMENT ON TABLE public.chat_rooms IS 'Chat rooms (direct, group, or public)';
COMMENT ON TABLE public.room_members IS 'Members in chat rooms with roles and read tracking';
COMMENT ON TABLE public.messages IS 'Messages in chat rooms with support for replies and file attachments';

COMMENT ON COLUMN public.profiles.nickname IS 'Display name for chat rooms, can differ from full_name';
COMMENT ON COLUMN public.profiles.zalo_id IS 'Zalo user ID from OAuth, unique identifier';
COMMENT ON COLUMN public.profiles.membership IS 'Membership tier: free or premium';

COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-create profile when new user signs up';
COMMENT ON FUNCTION public.get_my_profile() IS 'Get current user profile';
COMMENT ON FUNCTION public.is_premium_user() IS 'Check if user has active premium membership';
COMMENT ON FUNCTION public.link_zalo_account(text, text, text, text) IS 'Link Zalo account to current user';
COMMENT ON FUNCTION public.create_direct_chat(uuid, text) IS 'Create or get direct chat between 2 users';
COMMENT ON FUNCTION public.get_my_rooms() IS 'Get user rooms with unread count and metadata';
COMMENT ON FUNCTION public.count_unread_messages(uuid) IS 'Count unread messages in a room';
COMMENT ON FUNCTION public.mark_room_as_read(uuid) IS 'Mark all messages in room as read';

-- =====================================================
-- ✅ SETUP COMPLETE!
-- =====================================================
--
-- Next steps:
-- 1. Enable Realtime: Database > Replication > Enable for messages, room_members, chat_rooms
-- 2. Test authentication flow
-- 3. Test chat functionality
--
-- Functions available:
-- - get_my_profile()
-- - is_premium_user()
-- - link_zalo_account(zalo_id, full_name, avatar_url, phone_number)
-- - create_direct_chat(other_user_id, room_name)
-- - get_my_rooms()
-- - count_unread_messages(room_id)
-- - mark_room_as_read(room_id)
--
-- =====================================================
