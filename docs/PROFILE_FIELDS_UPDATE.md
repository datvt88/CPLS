# 📝 Cập Nhật: Profile Fields (Số điện thoại bắt buộc)

## ✅ Những Thay Đổi

### 1. Trường Bắt Buộc (Required)

Profile giờ có **2 trường bắt buộc**:

| Trường | Type | Mô Tả | Validation |
|--------|------|-------|------------|
| `email` | text | Email (REQUIRED) | NOT NULL, UNIQUE |
| `phone_number` | text | **Số điện thoại (BẮT BUỘC)** | NOT NULL, format: 9-20 ký tự |

### 2. Trường Tùy Chọn (Optional)

| Trường | Type | Mô Tả |
|--------|------|-------|
| `full_name` | text | Họ tên đầy đủ |
| `nickname` | text | Tên hiển thị (2-50 ký tự) |
| `stock_account_number` | text | Số tài khoản chứng khoán |
| `avatar_url` | text | URL ảnh đại diện |

---

## 📊 Database Schema

```sql
CREATE TABLE profiles (
  -- Required fields
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  phone_number text NOT NULL,  -- ⭐ BẮT BUỘC

  -- Optional fields
  full_name text,
  nickname text,
  stock_account_number text,
  avatar_url text,

  -- Other fields...
  zalo_id text UNIQUE,
  membership text DEFAULT 'free',
  created_at timestamptz,
  updated_at timestamptz,

  -- Constraints
  CONSTRAINT nickname_length_check
    CHECK (nickname IS NULL OR (char_length(nickname) >= 2 AND char_length(nickname) <= 50)),

  CONSTRAINT phone_format_check
    CHECK (phone_number ~ '^[0-9+\-\s()]{9,20}$')
);
```

### Phone Number Format

**Regex**: `^[0-9+\-\s()]{9,20}$`

**Cho phép**:
- ✅ `0901234567`
- ✅ `+84901234567`
- ✅ `(84) 90-123-4567`
- ✅ `0901 234 567`

**Không cho phép**:
- ❌ `abc123` (chữ cái)
- ❌ `12345` (quá ngắn < 9 ký tự)
- ❌ Ký tự đặc biệt khác (chỉ cho phép: `+ - space ()`)

---

## 🔧 TypeScript Interfaces

### Profile Interface

```typescript
export interface Profile {
  id: string
  email: string
  phone_number: string  // ⭐ BẮT BUỘC (không có dấu ?)
  full_name?: string
  nickname?: string
  stock_account_number?: string
  avatar_url?: string
  zalo_id?: string
  membership: 'free' | 'premium'
  // ...
}
```

### CreateProfileData Interface

```typescript
export interface CreateProfileData {
  id: string
  email: string
  phone_number: string  // ⭐ BẮT BUỘC
  full_name?: string
  nickname?: string
  stock_account_number?: string
  avatar_url?: string
  zalo_id?: string
  membership?: 'free' | 'premium'
  created_at?: string
}
```

---

## 📚 Functions Mới/Cập Nhật

### 1. `update_my_profile()` (MỚI)

Cập nhật toàn bộ profile với validation:

```typescript
const { data } = await supabase.rpc('update_my_profile', {
  p_phone_number: '0901234567',
  p_nickname: 'Trader Pro',
  p_full_name: 'Nguyễn Văn A',
  p_stock_account_number: '1234567890',
  p_avatar_url: 'https://...'
})
```

**Validates**:
- ✅ Phone number format (9-20 chars)
- ✅ Nickname length (2-50 chars)

### 2. `is_profile_complete()` (MỚI)

Kiểm tra profile đã đủ thông tin bắt buộc chưa:

```typescript
const { data: isComplete } = await supabase.rpc('is_profile_complete')

if (!isComplete) {
  // Redirect đến trang hoàn thiện profile
  router.push('/profile/setup')
}
```

**Kiểm tra**:
- ✅ `email` NOT NULL
- ✅ `phone_number` NOT NULL
- ✅ `full_name` NOT NULL

### 3. Functions Khác (Đã Có)

- `get_my_profile()` - Lấy profile hiện tại
- `update_my_nickname(nickname)` - Cập nhật nickname
- `get_display_name(user_id)` - Lấy tên hiển thị
- `is_premium_user()` - Kiểm tra premium
- `link_zalo_account(...)` - Link Zalo

---

## 🚀 Cách Sử Dụng

### 1. Tạo Profile với Phone Number

```typescript
import { profileService } from '@/services/profile.service'

await profileService.upsertProfile({
  id: userId,
  email: 'user@example.com',
  phone_number: '0901234567',  // ⭐ BẮT BUỘC
  full_name: 'Nguyễn Văn A',
  nickname: 'Trader Pro',
  membership: 'free'
})
```

### 2. Update Profile

```typescript
// Cách 1: Dùng profileService
await profileService.updateProfile(userId, {
  phone_number: '0987654321',
  nickname: 'New Nickname',
  stock_account_number: '1234567890'
})

// Cách 2: Dùng Supabase RPC (có validation)
const { data } = await supabase.rpc('update_my_profile', {
  p_phone_number: '0987654321',
  p_nickname: 'New Nickname',
  p_stock_account_number: '1234567890'
})
```

### 3. Validate Profile Form

```typescript
function validateProfileForm(data: any): string | null {
  // Phone number required
  if (!data.phone_number) {
    return 'Số điện thoại là bắt buộc'
  }

  // Phone format
  const phoneRegex = /^[0-9+\-\s()]{9,20}$/
  if (!phoneRegex.test(data.phone_number)) {
    return 'Số điện thoại không hợp lệ (9-20 ký tự, chỉ số và +, -, space, ())'
  }

  // Nickname length (nếu có)
  if (data.nickname && (data.nickname.length < 2 || data.nickname.length > 50)) {
    return 'Nickname phải từ 2-50 ký tự'
  }

  return null // Valid
}
```

### 4. Profile Setup Page

```typescript
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ProfileSetupPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [nickname, setNickname] = useState('')
  const [stockAccount, setStockAccount] = useState('')

  const handleSubmit = async () => {
    // Validate
    if (!phoneNumber) {
      alert('Vui lòng nhập số điện thoại')
      return
    }

    // Update profile
    const { data, error } = await supabase.rpc('update_my_profile', {
      p_phone_number: phoneNumber,
      p_nickname: nickname,
      p_stock_account_number: stockAccount
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Cập nhật thành công!')
    }
  }

  return (
    <div>
      <h1>Hoàn Thiện Profile</h1>

      <div>
        <label>Số điện thoại (bắt buộc) *</label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="0901234567"
          required
        />
      </div>

      <div>
        <label>Nickname</label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Tên hiển thị"
        />
      </div>

      <div>
        <label>Số tài khoản chứng khoán</label>
        <input
          value={stockAccount}
          onChange={(e) => setStockAccount(e.target.value)}
          placeholder="1234567890"
        />
      </div>

      <button onClick={handleSubmit}>
        Lưu thông tin
      </button>
    </div>
  )
}
```

---

## 🔄 Migration từ Schema Cũ

Nếu bạn đã có database với schema cũ (phone_number optional):

### Option 1: Update Existing Records

```sql
-- Set default phone cho records chưa có
UPDATE profiles
SET phone_number = '0000000000'
WHERE phone_number IS NULL OR phone_number = '';

-- Sau đó alter column
ALTER TABLE profiles
ALTER COLUMN phone_number SET NOT NULL;

-- Add constraint
ALTER TABLE profiles
ADD CONSTRAINT phone_format_check
CHECK (phone_number ~ '^[0-9+\-\s()]{9,20}$');
```

### Option 2: Fresh Start

Nếu chưa có data quan trọng, drop và recreate:

```sql
DROP TABLE IF EXISTS profiles CASCADE;

-- Chạy script mới: scripts/supabase-auth-profile-setup.sql
```

---

## 🧪 Testing

### Test 1: Tạo Profile

```sql
-- Trong SQL Editor
INSERT INTO profiles (id, email, phone_number, full_name, membership)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  '0901234567',
  'Test User',
  'free'
);

-- Kết quả: Success ✅
```

### Test 2: Invalid Phone Number

```sql
-- Phone number quá ngắn
INSERT INTO profiles (id, email, phone_number)
VALUES (gen_random_uuid(), 'test2@example.com', '12345');

-- Kết quả: ERROR (violates phone_format_check) ❌
```

### Test 3: Missing Phone Number

```sql
INSERT INTO profiles (id, email)
VALUES (gen_random_uuid(), 'test3@example.com');

-- Kết quả: ERROR (phone_number cannot be null) ❌
```

### Test 4: Update Profile

```typescript
const { data } = await supabase.rpc('update_my_profile', {
  p_phone_number: '+84901234567',
  p_nickname: 'Test'
})
console.log(data) // ✅ Success
```

---

## 📂 Files Đã Cập Nhật

```
✅ scripts/supabase-auth-profile-setup.sql  (Script SQL chính)
✅ schema.sql                                (Base schema)
✅ services/profile.service.ts               (TypeScript interfaces)
✅ app/auth/callback/page.tsx                (Zalo OAuth callback)
```

---

## 🎯 Checklist

Sau khi áp dụng các thay đổi:

- [ ] Chạy script SQL mới trong Supabase
- [ ] Verify phone_number là NOT NULL
- [ ] Test tạo profile với phone number
- [ ] Test validation (phone format, nickname length)
- [ ] Cập nhật UI forms để require phone number
- [ ] Test Zalo OAuth flow (auto-fill phone từ Zalo)
- [ ] Test function `is_profile_complete()`
- [ ] Test function `update_my_profile()`

---

**Tạo bởi**: CPLS Development Team
**Ngày cập nhật**: 2025-11-14
**Branch**: `claude/check-zalo-auth-nick-01CyzQ5SFjWRTLYf94pj2JW7`
