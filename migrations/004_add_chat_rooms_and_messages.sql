-- =====================================================
-- MIGRATION: Chat Rooms và Messages cho Real-time Chat
-- =====================================================
-- Tạo các bảng cần thiết cho tính năng chat realtime
-- với Supabase Realtime subscriptions
-- =====================================================

-- =====================================================
-- 1. CHAT ROOMS TABLE
-- =====================================================

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

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON public.chat_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON public.chat_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_active ON public.chat_rooms(is_active);

-- Comments
COMMENT ON TABLE public.chat_rooms IS 'Các phòng chat trong hệ thống';
COMMENT ON COLUMN public.chat_rooms.room_type IS 'Loại phòng: direct (1-1), group (nhiều người), public (công khai)';
COMMENT ON COLUMN public.chat_rooms.name IS 'Tên phòng chat';
COMMENT ON COLUMN public.chat_rooms.is_active IS 'Phòng có đang hoạt động không';

-- =====================================================
-- 2. ROOM MEMBERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz DEFAULT NOW(),
  last_read_at timestamptz DEFAULT NOW(),
  is_muted boolean DEFAULT false,
  -- Unique constraint: một user chỉ có thể là member của một room một lần
  UNIQUE(room_id, user_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_room_members_room ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_role ON public.room_members(role);

-- Comments
COMMENT ON TABLE public.room_members IS 'Thành viên trong các phòng chat';
COMMENT ON COLUMN public.room_members.role IS 'Vai trò: owner (chủ phòng), admin (quản trị viên), member (thành viên)';
COMMENT ON COLUMN public.room_members.last_read_at IS 'Thời điểm đọc tin nhắn cuối cùng (để đếm unread messages)';

-- =====================================================
-- 3. MESSAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  metadata jsonb DEFAULT '{}'::jsonb,  -- Lưu thêm thông tin như file URL, image URL, etc.
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,  -- Tin nhắn trả lời
  is_edited boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_room ON public.messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON public.messages(reply_to);

-- Comments
COMMENT ON TABLE public.messages IS 'Tin nhắn trong các phòng chat';
COMMENT ON COLUMN public.messages.message_type IS 'Loại tin nhắn: text, image, file, system';
COMMENT ON COLUMN public.messages.metadata IS 'Dữ liệu bổ sung (JSON): file_url, file_name, image_url, etc.';
COMMENT ON COLUMN public.messages.reply_to IS 'ID của tin nhắn được trả lời';

-- =====================================================
-- 4. TRIGGERS: Auto-update timestamps
-- =====================================================

-- Trigger for chat_rooms
CREATE TRIGGER update_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for messages
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Chat Rooms Policies
-- User có thể xem room mà họ là member
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
    OR room_type = 'public'  -- Public rooms có thể được xem bởi tất cả
  );

-- User có thể tạo room
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
CREATE POLICY "Users can create rooms"
  ON public.chat_rooms
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Owner/Admin có thể update room
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
-- User có thể xem members của room mà họ là member
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

-- User có thể join room (insert themselves)
DROP POLICY IF EXISTS "Users can join rooms" ON public.room_members;
CREATE POLICY "Users can join rooms"
  ON public.room_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User có thể update own membership (last_read_at, is_muted)
DROP POLICY IF EXISTS "Users can update own membership" ON public.room_members;
CREATE POLICY "Users can update own membership"
  ON public.room_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owner/Admin có thể remove members
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
-- User có thể xem messages của room mà họ là member
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

-- User có thể gửi messages vào room mà họ là member
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

-- User có thể update own messages (edit)
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- User có thể delete own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id);

-- =====================================================
-- 6. HELPER FUNCTIONS: Chat operations
-- =====================================================

-- Function: Tạo direct chat giữa 2 users
CREATE OR REPLACE FUNCTION public.create_direct_chat(
  p_other_user_id uuid,
  p_room_name text DEFAULT NULL
)
RETURNS public.chat_rooms AS $$
DECLARE
  v_room public.chat_rooms;
  v_existing_room public.chat_rooms;
BEGIN
  -- Kiểm tra xem đã có direct chat giữa 2 users chưa
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

  -- Tạo room mới
  INSERT INTO public.chat_rooms (name, room_type, created_by)
  VALUES (
    COALESCE(p_room_name, 'Direct Chat'),
    'direct',
    auth.uid()
  )
  RETURNING * INTO v_room;

  -- Thêm cả 2 users vào room
  INSERT INTO public.room_members (room_id, user_id, role)
  VALUES
    (v_room.id, auth.uid(), 'owner'),
    (v_room.id, p_other_user_id, 'member');

  RETURN v_room;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Đếm số unread messages trong room
CREATE OR REPLACE FUNCTION public.count_unread_messages(p_room_id uuid)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_last_read_at timestamptz;
BEGIN
  -- Lấy thời điểm đọc cuối cùng
  SELECT last_read_at INTO v_last_read_at
  FROM public.room_members
  WHERE room_id = p_room_id
  AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Đếm messages sau thời điểm đó
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.messages
  WHERE room_id = p_room_id
  AND created_at > v_last_read_at
  AND sender_id != auth.uid()  -- Không đếm messages của chính mình
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

-- Function: Lấy danh sách rooms của user với unread count
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
-- 7. COMMENTS for functions
-- =====================================================

COMMENT ON FUNCTION public.create_direct_chat(uuid, text) IS 'Tạo hoặc lấy direct chat giữa 2 users';
COMMENT ON FUNCTION public.count_unread_messages(uuid) IS 'Đếm số tin nhắn chưa đọc trong room';
COMMENT ON FUNCTION public.mark_room_as_read(uuid) IS 'Đánh dấu tất cả messages trong room là đã đọc';
COMMENT ON FUNCTION public.get_my_rooms() IS 'Lấy danh sách rooms của user hiện tại với thông tin tổng hợp';

-- =====================================================
-- HOÀN THÀNH!
-- =====================================================
-- Để sử dụng real-time chat:
-- 1. Chạy migration này trong Supabase SQL Editor
-- 2. Bật Realtime cho các bảng trong Supabase Dashboard
-- 3. Subscribe đến messages table từ client code
-- 4. Sử dụng các functions helper để quản lý rooms và messages
-- =====================================================
