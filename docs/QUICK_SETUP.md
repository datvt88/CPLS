# 🚀 Hướng Dẫn Nhanh: Xác Thực Zalo & Profile với Nickname

Hướng dẫn thiết lập đăng ký/đăng nhập Zalo với Supabase, có nickname làm tên hiển thị.

---

## ✅ Tính Năng

- ✅ Đăng ký/Đăng nhập với **Zalo OAuth**
- ✅ Tự động tạo profile khi đăng ký
- ✅ Trường **Nickname** (user tự đặt) làm tên hiển thị
- ✅ Lưu trữ và xác thực trên **Supabase**
- ✅ Row Level Security (RLS) bảo mật
- ❌ **KHÔNG có chat** (chỉ auth + profile)

---

## 📝 Setup Supabase (3 Bước)

### Bước 1️⃣: Copy Script SQL

```bash
# Mở file: scripts/supabase-auth-profile-setup.sql
# Copy toàn bộ nội dung (Ctrl+A → Ctrl+C)
```

### Bước 2️⃣: Chạy Trong Supabase SQL Editor

1. Đăng nhập **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Chọn project của bạn
3. Vào **SQL Editor** (icon `</>`)
4. Click **New Query**
5. Paste script
6. Click **Run** (hoặc `Ctrl+Enter`)
7. Đợi ~5-10 giây → Thấy "Success" ✅

### Bước 3️⃣: Lấy API Keys

1. Vào **Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon/public key**: `eyJhbGc...`
3. Thêm vào `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

---

## 🔐 Cấu Hình Zalo OAuth

### 1. Đăng Ký App Zalo

1. Vào [developers.zalo.me](https://developers.zalo.me)
2. Tạo ứng dụng mới
3. Lấy **App ID** và **App Secret**
4. Cấu hình **Redirect URI**: `https://your-domain.com/auth/callback`

### 2. Thêm Vào .env.local

```bash
NEXT_PUBLIC_ZALO_APP_ID=your_zalo_app_id
ZALO_APP_SECRET=your_zalo_app_secret
```

---

## ✅ Verify Setup Thành Công

Chạy queries sau trong **SQL Editor**:

### 1. Check Tables
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'profiles';
```
**Kết quả**: 1 row → ✅

### 2. Check Nickname Field
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'nickname';
```
**Kết quả**: `nickname | text` → ✅

### 3. Check Functions
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_my_profile',
  'update_my_nickname',
  'get_display_name'
);
```
**Kết quả**: 3 rows → ✅

---

## 📚 Functions Đã Tạo

### 1. `get_my_profile()`
Lấy profile của user hiện tại

```typescript
const { data } = await supabase.rpc('get_my_profile')
console.log(data) // { id, email, full_name, nickname, ... }
```

### 2. `update_my_nickname(nickname)`
Cập nhật nickname (2-50 ký tự)

```typescript
const { data } = await supabase.rpc('update_my_nickname', {
  p_nickname: 'Trader Pro'
})
console.log('Updated:', data.nickname)
```

### 3. `get_display_name(user_id)`
Lấy tên hiển thị (ưu tiên nickname, nếu không có dùng full_name)

```sql
-- Trong SQL query
SELECT get_display_name(user_id) AS display_name
FROM some_table;
```

```typescript
// Từ TypeScript
const { data } = await supabase.rpc('get_display_name', {
  p_user_id: 'uuid-here'
})
```

---

## 🎯 Sử Dụng Trong Code

### 1. Đăng Nhập Zalo

Code đã có sẵn trong `components/ZaloLoginButton.tsx`:

```typescript
<ZaloLoginButton />
```

### 2. Hiển Thị Profile với Nickname

```typescript
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { profileService } from '@/services/profile.service'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { profile } = await profileService.getProfile(user.id)
      setProfile(profile)
    }
  }

  const updateNickname = async (newNickname: string) => {
    const { data } = await supabase.rpc('update_my_nickname', {
      p_nickname: newNickname
    })
    setProfile(data)
  }

  // Hiển thị tên: Ưu tiên nickname
  const displayName = profile?.nickname || profile?.full_name || 'User'

  return (
    <div>
      <h1>Xin chào, {displayName}!</h1>

      <div>
        <label>Nickname (tên hiển thị):</label>
        <input
          value={profile?.nickname || ''}
          onChange={(e) => updateNickname(e.target.value)}
          placeholder="Nhập nickname của bạn"
        />
      </div>

      <div>
        <p>Họ tên: {profile?.full_name}</p>
        <p>Email: {profile?.email}</p>
        <p>Membership: {profile?.membership}</p>
      </div>
    </div>
  )
}
```

### 3. Cập Nhật Profile Service

Code trong `services/profile.service.ts` đã có sẵn:

```typescript
// Interface đã có nickname
export interface Profile {
  id: string
  email: string
  full_name?: string
  nickname?: string  // ✅ Đã có
  // ...
}

// Update profile với nickname
const { profile } = await profileService.updateProfile(userId, {
  nickname: 'My Cool Nickname'
})
```

---

## 📊 Database Schema

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  full_name text,           -- Họ tên từ Zalo
  nickname text,            -- ⭐ Tên hiển thị (user tự đặt)
  phone_number text,
  avatar_url text,
  zalo_id text UNIQUE,      -- Zalo user ID
  membership text,          -- 'free' hoặc 'premium'
  created_at timestamptz,
  updated_at timestamptz,

  -- Constraint: nickname 2-50 ký tự
  CONSTRAINT nickname_length_check
    CHECK (nickname IS NULL OR (char_length(nickname) >= 2 AND char_length(nickname) <= 50))
);
```

**Ưu tiên hiển thị**:
1. `nickname` (nếu user đã đặt)
2. `full_name` (nếu không có nickname)
3. `'Unknown User'` (nếu cả 2 đều null)

---

## 🔒 Bảo Mật (RLS Policies)

Script tự động tạo các policies:

```sql
-- User chỉ xem profile của mình
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- User chỉ update profile của mình
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

✅ User **KHÔNG THỂ** xem hoặc sửa profile của người khác

---

## 🧪 Test Flow

### 1. Test Đăng Ký/Đăng Nhập Zalo

```bash
1. Click "Đăng nhập với Zalo"
2. Authorize ứng dụng trên Zalo
3. Redirect về /auth/callback
4. Profile tự động được tạo
5. Redirect đến /dashboard
```

### 2. Test Nickname

```sql
-- Trong SQL Editor
SELECT id, email, full_name, nickname,
       get_display_name(id) AS display_name
FROM profiles
WHERE email = 'your-email@example.com';
```

### 3. Test Update Nickname

```typescript
// Trong browser console
const { data } = await supabase.rpc('update_my_nickname', {
  p_nickname: 'Test Nickname'
})
console.log('Updated:', data)
```

---

## 🐛 Troubleshooting

### Lỗi: "column 'nickname' does not exist"

**Giải pháp**: Chạy lại script `supabase-auth-profile-setup.sql`

### Lỗi: "function update_my_nickname does not exist"

**Giải pháp**: Script chưa chạy hoặc chạy không thành công. Check SQL Editor logs.

### Lỗi: "new row violates row-level security policy"

**Giải pháp**: RLS policies chưa được tạo. Chạy lại script.

### Profile không tự động tạo khi đăng ký

**Giải pháp**:
1. Check trigger có tồn tại không:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```
2. Nếu không có, chạy lại script

---

## 📂 Files Liên Quan

```
✅ scripts/supabase-auth-profile-setup.sql  (Script SQL chính)
✅ services/profile.service.ts              (TypeScript interfaces)
✅ components/ZaloLoginButton.tsx           (Zalo login button)
✅ app/auth/callback/page.tsx              (OAuth callback handler)
✅ app/api/auth/zalo/*                      (Zalo OAuth API routes)
```

---

## 🎯 Next Steps

Sau khi setup xong:

1. ✅ Test đăng ký/đăng nhập Zalo
2. ✅ Thêm UI để user update nickname trong profile page
3. ✅ Hiển thị nickname thay vì full_name trong navbar/header
4. ✅ Validate nickname (không cho ký tự đặc biệt nếu cần)

---

## 💡 Tips

### Hiển Thị Tên User

**Ưu tiên nickname**:
```typescript
const displayName = user.nickname || user.full_name || 'User'
```

**Trong SQL query**:
```sql
SELECT get_display_name(user_id) AS name FROM ...
```

### Validate Nickname

```typescript
function validateNickname(nickname: string): boolean {
  // 2-50 ký tự, chỉ chữ cái, số, space, dấu gạch ngang
  const regex = /^[a-zA-ZÀ-ỹ0-9 -]{2,50}$/
  return regex.test(nickname)
}
```

### Placeholder Nickname

```typescript
// Nếu user chưa đặt nickname, hiển thị gợi ý
const displayName = profile?.nickname || `User${profile?.id.slice(0,6)}`
```

---

**Tạo bởi**: CPLS Development Team
**Cập nhật**: 2025-11-14
**Script**: `scripts/supabase-auth-profile-setup.sql`
