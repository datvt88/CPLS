# Hướng Dẫn Thiết Lập Supabase - Xác Thực Zalo & Chat Realtime

Tài liệu này hướng dẫn cách thiết lập và sử dụng các scripts Supabase để tạo tài khoản, đăng nhập và xác thực người dùng với Zalo OAuth, cũng như xây dựng hệ thống chat realtime.

## 📋 Mục Lục

1. [Giới Thiệu](#giới-thiệu)
2. [Yêu Cầu](#yêu-cầu)
3. [Cài Đặt Migrations](#cài-đặt-migrations)
4. [Thiết Lập Xác Thực Zalo](#thiết-lập-xác-thực-zalo)
5. [Sử Dụng Realtime Chat](#sử-dụng-realtime-chat)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Giới Thiệu

Hệ thống CPLS sử dụng Supabase để quản lý:
- **Authentication**: Đăng ký/đăng nhập với email hoặc Zalo OAuth
- **User Profiles**: Lưu trữ thông tin người dùng với trường `nickname` cho chat
- **Real-time Chat**: Hệ thống chat rooms với Supabase Realtime

### Các File Scripts Quan Trọng

```
CPLS/
├── migrations/
│   ├── 001_add_user_fields_and_zalo.sql      # Thêm fields Zalo
│   ├── 002_add_tcbs_integration.sql          # Tích hợp TCBS
│   ├── 003_add_nickname_field.sql            # ✨ Thêm nickname cho chat
│   └── 004_add_chat_rooms_and_messages.sql   # ✨ Tables cho chat
├── scripts/
│   └── supabase-auth-sync.sql                # ✨ Auth triggers & functions
└── schema.sql                                 # Schema chính (đã cập nhật)
```

---

## 📦 Yêu Cầu

### 1. Supabase Project

Tạo project trên [supabase.com](https://supabase.com) và lấy:
- **Project URL**: `https://your-project.supabase.co`
- **Anon/Public Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Environment Variables

Tạo file `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Zalo OAuth
NEXT_PUBLIC_ZALO_APP_ID=your_zalo_app_id
ZALO_APP_SECRET=your_zalo_app_secret
```

### 3. Zalo OAuth Setup

1. Đăng ký ứng dụng tại [developers.zalo.me](https://developers.zalo.me)
2. Lấy **App ID** và **App Secret**
3. Cấu hình **Redirect URI**: `https://your-domain.com/auth/callback`
4. Kích hoạt các scopes: `id`, `name`, `picture`, `phone`

---

## 🚀 Cài Đặt Migrations

### Bước 1: Chạy Schema Chính

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Tạo query mới và paste nội dung từ `schema.sql`
3. Nhấn **Run** để tạo bảng `profiles` và `signals`

### Bước 2: Thêm Nickname Field

Chạy migration `003_add_nickname_field.sql`:

```sql
-- Thêm trường nickname vào profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname);

ALTER TABLE profiles ADD CONSTRAINT nickname_length_check
  CHECK (nickname IS NULL OR (char_length(nickname) >= 2 AND char_length(nickname) <= 50));
```

**Kết quả**: Bảng `profiles` giờ có trường `nickname` để hiển thị trong chat.

### Bước 3: Thiết Lập Auth Sync

Chạy script `scripts/supabase-auth-sync.sql`:

```sql
-- Script này sẽ tạo:
-- ✅ Trigger tự động tạo profile khi user đăng ký
-- ✅ RLS policies bảo mật
-- ✅ Helper functions: get_my_profile(), is_premium_user(), link_zalo_account()
```

**Quan Trọng**: Script này PHẢI chạy sau khi đã có bảng `profiles`.

### Bước 4: Thiết Lập Chat Tables

Chạy migration `004_add_chat_rooms_and_messages.sql`:

```sql
-- Script này sẽ tạo:
-- ✅ Bảng chat_rooms, room_members, messages
-- ✅ RLS policies cho chat
-- ✅ Functions: create_direct_chat(), get_my_rooms(), count_unread_messages()
```

### Bước 5: Bật Realtime

1. Vào **Database** → **Replication**
2. Bật Realtime cho các bảng:
   - ✅ `messages`
   - ✅ `room_members`
   - ✅ `chat_rooms`

---

## 🔐 Thiết Lập Xác Thực Zalo

### Luồng Xác Thực

```
┌─────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│  User   │────────>│  Zalo    │────────>│  CPLS    │────────>│ Supabase │
│ Browser │  Click  │  OAuth   │Callback │ Callback │  Auth   │   Auth   │
└─────────┘         └──────────┘         └──────────┘         └──────────┘
                                               │
                                               v
                                        Create/Update
                                          Profile
```

### Code Minh Họa

#### 1. Đăng Nhập với Zalo (Client)

```typescript
// components/ZaloLoginButton.tsx
import { useState } from 'react'

export default function ZaloLoginButton() {
  const handleZaloLogin = async () => {
    try {
      // Tạo CSRF state token
      const state = crypto.randomUUID()
      sessionStorage.setItem('zalo_oauth_state', state)

      // Gọi API để lấy authorization URL
      const response = await fetch('/api/auth/zalo/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      })

      const { authUrl } = await response.json()

      // Redirect đến Zalo OAuth
      window.location.href = authUrl
    } catch (error) {
      console.error('Zalo login error:', error)
    }
  }

  return (
    <button onClick={handleZaloLogin}>
      Đăng nhập với Zalo
    </button>
  )
}
```

#### 2. Xử Lý Callback (Server & Client)

File `app/auth/callback/page.tsx` đã xử lý:
1. ✅ Nhận `code` từ Zalo
2. ✅ Exchange code → access token
3. ✅ Lấy user info từ Zalo
4. ✅ Tạo/đăng nhập user vào Supabase
5. ✅ Tạo/cập nhật profile với `zalo_id` và `nickname`

#### 3. Sử Dụng Auth Service

```typescript
// services/auth.service.ts
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'

// Lấy user hiện tại
const { user } = await authService.getUser()

// Lấy profile
const { profile } = await profileService.getProfile(user.id)

// Kiểm tra premium
const isPremium = await profileService.isPremium(user.id)

// Đăng xuất
await authService.signOut()
```

---

## 💬 Sử Dụng Realtime Chat

### 1. Tạo Direct Chat

```typescript
import { supabase } from '@/lib/supabaseClient'

async function createDirectChat(otherUserId: string) {
  // Gọi function tạo direct chat
  const { data, error } = await supabase.rpc('create_direct_chat', {
    p_other_user_id: otherUserId,
    p_room_name: 'Chat với User'
  })

  if (error) {
    console.error('Error creating chat:', error)
    return null
  }

  return data // Trả về chat_room
}
```

### 2. Lấy Danh Sách Rooms

```typescript
async function getMyRooms() {
  const { data, error } = await supabase.rpc('get_my_rooms')

  if (error) {
    console.error('Error fetching rooms:', error)
    return []
  }

  return data
  // Trả về: { room_id, room_name, room_type, unread_count, ... }
}
```

### 3. Subscribe Realtime Messages

```typescript
import { useEffect, useState } from 'react'

function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState([])

  useEffect(() => {
    // Subscribe đến messages mới
    const channel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('New message:', payload.new)
          setMessages((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    // Cleanup
    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          <strong>{msg.sender_id}</strong>: {msg.content}
        </div>
      ))}
    </div>
  )
}
```

### 4. Gửi Tin Nhắn

```typescript
async function sendMessage(roomId: string, content: string) {
  const { user } = await authService.getUser()

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: user.id,
      content: content,
      message_type: 'text'
    })
    .select()
    .single()

  if (error) {
    console.error('Error sending message:', error)
    return null
  }

  return data
}
```

### 5. Đếm Unread Messages

```typescript
async function getUnreadCount(roomId: string) {
  const { data, error } = await supabase.rpc('count_unread_messages', {
    p_room_id: roomId
  })

  return data || 0
}
```

### 6. Đánh Dấu Đã Đọc

```typescript
async function markAsRead(roomId: string) {
  await supabase.rpc('mark_room_as_read', {
    p_room_id: roomId
  })
}
```

---

## 📚 API Reference

### Supabase RPC Functions

#### `get_my_profile()`
Lấy profile của user hiện tại.

```typescript
const { data, error } = await supabase.rpc('get_my_profile')
// Returns: Profile object
```

#### `is_premium_user()`
Kiểm tra user có premium không.

```typescript
const { data, error } = await supabase.rpc('is_premium_user')
// Returns: boolean
```

#### `link_zalo_account(p_zalo_id, p_full_name?, p_avatar_url?, p_phone_number?)`
Link Zalo account với user hiện tại.

```typescript
const { data, error } = await supabase.rpc('link_zalo_account', {
  p_zalo_id: '1234567890',
  p_full_name: 'Nguyễn Văn A',
  p_avatar_url: 'https://...',
  p_phone_number: '0901234567'
})
// Returns: Updated profile
```

#### `create_direct_chat(p_other_user_id, p_room_name?)`
Tạo hoặc lấy direct chat giữa 2 users.

```typescript
const { data, error } = await supabase.rpc('create_direct_chat', {
  p_other_user_id: 'uuid-of-other-user',
  p_room_name: 'Chat với User B'
})
// Returns: chat_room object
```

#### `get_my_rooms()`
Lấy danh sách rooms với unread count.

```typescript
const { data, error } = await supabase.rpc('get_my_rooms')
// Returns: Array of room info
```

#### `count_unread_messages(p_room_id)`
Đếm tin nhắn chưa đọc.

```typescript
const { data, error } = await supabase.rpc('count_unread_messages', {
  p_room_id: 'room-uuid'
})
// Returns: integer
```

#### `mark_room_as_read(p_room_id)`
Đánh dấu room đã đọc.

```typescript
await supabase.rpc('mark_room_as_read', {
  p_room_id: 'room-uuid'
})
```

---

## 🔍 Database Schema

### Bảng `profiles`

| Column                  | Type          | Description                        |
|-------------------------|---------------|------------------------------------|
| `id`                    | uuid          | User ID (FK to auth.users)         |
| `email`                 | text          | Email address                      |
| `full_name`             | text          | Họ tên đầy đủ                      |
| `nickname`              | text          | **Tên hiển thị trong chat** ✨     |
| `phone_number`          | text          | Số điện thoại                      |
| `avatar_url`            | text          | URL ảnh đại diện                   |
| `zalo_id`               | text          | Zalo user ID (unique)              |
| `membership`            | text          | 'free' hoặc 'premium'              |
| `membership_expires_at` | timestamptz   | Ngày hết hạn premium               |
| `created_at`            | timestamptz   | Ngày tạo                           |
| `updated_at`            | timestamptz   | Ngày cập nhật                      |

### Bảng `chat_rooms`

| Column        | Type        | Description                              |
|---------------|-------------|------------------------------------------|
| `id`          | uuid        | Room ID                                  |
| `name`        | text        | Tên phòng chat                           |
| `room_type`   | text        | 'direct', 'group', 'public'              |
| `avatar_url`  | text        | Ảnh đại diện phòng                       |
| `created_by`  | uuid        | User tạo phòng                           |
| `is_active`   | boolean     | Phòng có hoạt động không                 |
| `created_at`  | timestamptz | Ngày tạo                                 |

### Bảng `room_members`

| Column          | Type        | Description                        |
|-----------------|-------------|------------------------------------|
| `id`            | uuid        | Member ID                          |
| `room_id`       | uuid        | FK to chat_rooms                   |
| `user_id`       | uuid        | FK to profiles                     |
| `role`          | text        | 'owner', 'admin', 'member'         |
| `joined_at`     | timestamptz | Ngày tham gia                      |
| `last_read_at`  | timestamptz | Thời điểm đọc cuối                 |
| `is_muted`      | boolean     | Có tắt thông báo không             |

### Bảng `messages`

| Column          | Type        | Description                        |
|-----------------|-------------|------------------------------------|
| `id`            | uuid        | Message ID                         |
| `room_id`       | uuid        | FK to chat_rooms                   |
| `sender_id`     | uuid        | FK to profiles                     |
| `content`       | text        | Nội dung tin nhắn                  |
| `message_type`  | text        | 'text', 'image', 'file', 'system'  |
| `metadata`      | jsonb       | Dữ liệu bổ sung                    |
| `reply_to`      | uuid        | Tin nhắn được reply                |
| `is_edited`     | boolean     | Đã chỉnh sửa?                      |
| `is_deleted`    | boolean     | Đã xóa?                            |
| `created_at`    | timestamptz | Ngày tạo                           |

---

## ❗ Troubleshooting

### Lỗi: "new row violates row-level security policy"

**Nguyên nhân**: RLS đã bật nhưng không có policy phù hợp.

**Giải pháp**:
1. Kiểm tra đã chạy `supabase-auth-sync.sql` chưa
2. Verify policies trong Supabase Dashboard → Authentication → Policies

### Lỗi: "function does not exist"

**Nguyên nhân**: Chưa chạy migration scripts.

**Giải pháp**:
1. Chạy lần lượt các migrations: 003, 004, và auth-sync script
2. Refresh schema trong Supabase Dashboard

### Lỗi: "column 'nickname' does not exist"

**Nguyên nhân**: Chưa chạy migration `003_add_nickname_field.sql`.

**Giải pháp**:
```sql
ALTER TABLE profiles ADD COLUMN nickname TEXT;
```

### Realtime không hoạt động

**Nguyên nhân**: Chưa bật Realtime cho tables.

**Giải pháp**:
1. Vào **Database** → **Replication**
2. Bật cho `messages`, `room_members`, `chat_rooms`

---

## 🎉 Hoàn Thành!

Bây giờ bạn đã có:
- ✅ Hệ thống xác thực Zalo hoàn chỉnh
- ✅ Profile với nickname cho chat
- ✅ Realtime chat với rooms và messages
- ✅ RLS policies bảo mật
- ✅ Helper functions tiện lợi

### Các Bước Tiếp Theo

1. **Frontend UI**: Xây dựng giao diện chat với React/Next.js
2. **Notifications**: Thêm push notifications cho tin nhắn mới
3. **File Upload**: Tích hợp Supabase Storage cho ảnh/file
4. **Typing Indicators**: Hiển thị "đang gõ..." với Presence
5. **Message Reactions**: Thêm reactions (like, love, etc.)

### Tài Liệu Tham Khảo

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Zalo Developers](https://developers.zalo.me/docs)

---

**Tác giả**: CPLS Development Team
**Cập nhật lần cuối**: 2025-11-14
