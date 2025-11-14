# 🚀 Hướng Dẫn Nhanh: Setup Supabase

## Script All-in-One

File: **`supabase-complete-setup.sql`**

Script này bao gồm TẤT CẢ migrations và setup cho CPLS trong 1 file duy nhất.

---

## 📝 Cách Sử Dụng (3 Bước)

### Bước 1: Copy Script

```bash
# Mở file: scripts/supabase-complete-setup.sql
# Chọn tất cả (Ctrl+A / Cmd+A)
# Copy (Ctrl+C / Cmd+C)
```

### Bước 2: Chạy Trong Supabase

1. Đăng nhập [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng `</>` ở sidebar trái)
4. Click **New Query**
5. Paste script vào
6. Click **Run** (hoặc Ctrl+Enter)
7. Đợi ~10-30 giây để hoàn thành

**Kết quả**: Thấy "Success" màu xanh ✅

### Bước 3: Bật Realtime

1. Vào **Database** → **Replication**
2. Tìm **supabase_realtime** publication
3. Click **Edit**
4. Tick chọn các tables:
   - ✅ `messages`
   - ✅ `room_members`
   - ✅ `chat_rooms`
5. Click **Save**

---

## ✅ Kiểm Tra Setup Thành Công

Chạy các queries sau trong SQL Editor để verify:

### 1. Check Tables Exist
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'chat_rooms', 'room_members', 'messages');
```
**Kết quả**: 4 rows

### 2. Check Nickname Field
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'nickname';
```
**Kết quả**: 1 row (nickname | text)

### 3. Check Functions
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_my_profile',
  'is_premium_user',
  'create_direct_chat',
  'get_my_rooms',
  'count_unread_messages',
  'mark_room_as_read'
);
```
**Kết quả**: 6 rows

### 4. Check Triggers
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name IN ('on_auth_user_created', 'update_profiles_updated_at');
```
**Kết quả**: 2 rows

### 5. Check RLS Policies
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```
**Kết quả**: Nhiều rows (policies cho profiles, chat_rooms, room_members, messages)

---

## 🧪 Test Functionality

### Test 1: Auto-Create Profile Trigger

Đăng ký user mới trong app, sau đó check:

```sql
SELECT id, email, full_name, nickname, membership
FROM profiles
ORDER BY created_at DESC
LIMIT 5;
```

Profile của user mới phải tự động được tạo.

### Test 2: Create Direct Chat

```typescript
// Trong code TypeScript
const { data, error } = await supabase.rpc('create_direct_chat', {
  p_other_user_id: 'uuid-of-other-user'
})
console.log('Room created:', data)
```

### Test 3: Realtime Messages

```typescript
const channel = supabase
  .channel('room-123')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: 'room_id=eq.123'
  }, (payload) => {
    console.log('New message:', payload.new)
  })
  .subscribe()
```

---

## 📚 Functions Đã Tạo

### Auth & Profile Functions

| Function | Mô Tả | Cách Dùng |
|----------|-------|-----------|
| `get_my_profile()` | Lấy profile user hiện tại | `SELECT * FROM get_my_profile()` |
| `is_premium_user()` | Kiểm tra premium membership | `SELECT is_premium_user()` |
| `link_zalo_account()` | Link Zalo với user | `SELECT link_zalo_account('zalo_id', 'name', 'avatar', 'phone')` |
| `find_or_create_user_by_zalo()` | Tìm/tạo user qua Zalo ID | (Internal use) |

### Chat Functions

| Function | Mô Tả | Cách Dùng |
|----------|-------|-----------|
| `create_direct_chat()` | Tạo chat 1-1 giữa 2 users | `SELECT * FROM create_direct_chat('user-uuid', 'Room Name')` |
| `get_my_rooms()` | Lấy danh sách rooms + metadata | `SELECT * FROM get_my_rooms()` |
| `count_unread_messages()` | Đếm tin chưa đọc | `SELECT count_unread_messages('room-uuid')` |
| `mark_room_as_read()` | Đánh dấu đã đọc | `SELECT mark_room_as_read('room-uuid')` |

---

## 🔧 Nếu Gặp Lỗi

### Lỗi: "relation already exists"

**Nguyên nhân**: Bảng đã tồn tại từ lần chạy trước.

**Giải pháp**: Script sử dụng `IF NOT EXISTS`, nên chạy lại sẽ bỏ qua các bảng đã có. Không sao cả!

### Lỗi: "permission denied"

**Nguyên nhân**: Chưa đủ quyền để tạo functions/triggers.

**Giải pháp**: Đảm bảo bạn đang đăng nhập với owner account của Supabase project.

### Lỗi: "function does not exist" khi gọi từ code

**Nguyên nhân**: Chưa chạy script hoặc script chưa thành công.

**Giải pháp**:
1. Quay lại SQL Editor
2. Chạy lại script `supabase-complete-setup.sql`
3. Check trong **Database** → **Functions** xem các functions đã có chưa

### Realtime không hoạt động

**Nguyên nhân**: Chưa bật Realtime cho tables.

**Giải pháp**: Làm Bước 3 ở trên (Bật Realtime).

---

## 📊 Database Schema Overview

```
┌─────────────┐
│  auth.users │ (Supabase managed)
└──────┬──────┘
       │ id (FK)
       ▼
┌─────────────┐       ┌──────────────┐
│  profiles   │◄──────┤ room_members │
└──────┬──────┘       └──────┬───────┘
       │                     │
       │ id (FK)            │ room_id (FK)
       │                     │
       ▼                     ▼
┌─────────────┐       ┌──────────────┐
│  messages   │◄──────┤  chat_rooms  │
└─────────────┘       └──────────────┘
```

**Key Relationships**:
- `profiles.id` → `auth.users.id` (CASCADE DELETE)
- `room_members.user_id` → `profiles.id` (CASCADE DELETE)
- `room_members.room_id` → `chat_rooms.id` (CASCADE DELETE)
- `messages.sender_id` → `profiles.id` (CASCADE DELETE)
- `messages.room_id` → `chat_rooms.id` (CASCADE DELETE)

---

## 🎯 Next Steps

Sau khi setup xong, bạn có thể:

1. **Test Auth Flow**: Đăng ký/đăng nhập với Zalo
2. **Build Chat UI**: Tạo components cho chat
3. **Test Realtime**: Subscribe messages và test gửi/nhận
4. **Add Features**: Typing indicators, file uploads, reactions, etc.

---

## 📖 Tài Liệu Chi Tiết

Xem thêm:
- [`docs/SUPABASE_SETUP_GUIDE.md`](../docs/SUPABASE_SETUP_GUIDE.md) - Hướng dẫn đầy đủ
- [`ZALO_AUTH_CHECKLIST.md`](../ZALO_AUTH_CHECKLIST.md) - Checklist tổng hợp

---

**Tạo bởi**: CPLS Development Team
**Cập nhật**: 2025-11-14
