# 🚀 Hướng Dẫn Đồng Bộ Supabase

Script SQL đầy đủ để đồng bộ database với Supabase.

---

## 📝 Script Chính

**File**: `supabase-sync-complete.sql`

Script này bao gồm **TẤT CẢ** thiết lập cần thiết cho CPLS:
- ✅ Bảng profiles (email, phone_number bắt buộc)
- ✅ Bảng signals
- ✅ Xác thực Zalo OAuth
- ✅ Trường nickname
- ✅ Auto-create profile trigger
- ✅ RLS policies bảo mật
- ✅ 10 functions quản lý profile
- ✅ 3 functions phân quyền Free/Premium
- ✅ Indexes tối ưu

---

## ⚡ Cách Sử Dụng (3 Bước)

### Bước 1: Copy Script

```bash
# Mở file: scripts/supabase-sync-complete.sql
# Copy toàn bộ nội dung (Ctrl+A → Ctrl+C)
```

### Bước 2: Chạy Trong Supabase

1. Đăng nhập **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Chọn project của bạn
3. Vào **SQL Editor** (icon `</>`)
4. Click **New Query**
5. **Paste** toàn bộ script
6. Click **Run** (hoặc Ctrl+Enter)
7. Đợi ~10-30 giây

**Kết quả**: Thấy "Success" màu xanh ✅

### Bước 3: Verify

Chạy query kiểm tra:

```sql
-- Check tables tồn tại
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('profiles', 'signals');
-- Kết quả: 2 rows ✅

-- Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
-- Kết quả: 13 functions ✅

-- Test phân quyền
SELECT * FROM get_my_accessible_features();
-- Kết quả: 8 rows (4 free + 4 premium) ✅
```

---

## 📊 Nội Dung Script

### Tables (2)

| Table | Mô Tả |
|-------|-------|
| `profiles` | User profiles với email, phone (required), nickname, membership |
| `signals` | Tín hiệu giao dịch (BUY/SELL/HOLD) |

### Functions (13)

#### Profile Management (7)

| Function | Mô Tả |
|----------|-------|
| `get_my_profile()` | Lấy profile hiện tại |
| `update_my_profile(...)` | Cập nhật profile (có validation) |
| `update_my_nickname(nickname)` | Cập nhật nickname |
| `is_profile_complete()` | Kiểm tra profile đã đủ thông tin |
| `get_display_name(user_id)` | Lấy tên hiển thị |
| `is_premium_user()` | Kiểm tra premium |
| `link_zalo_account(...)` | Link Zalo với user |

#### Permissions (3)

| Function | Mô Tả |
|----------|-------|
| `can_access_feature(feature)` | Kiểm tra quyền truy cập |
| `get_my_accessible_features()` | Lấy danh sách features |
| `require_premium()` | Throw exception nếu không premium |

#### Triggers (3)

| Trigger | Mô Tả |
|---------|-------|
| `on_auth_user_created` | Auto-create profile khi đăng ký |
| `update_profiles_updated_at` | Auto-update timestamp |
| RLS Policies | Bảo mật profiles table |

---

## ✅ Kiểm Tra Sau Khi Chạy

### 1. Check Tables

```sql
\dt public.*
-- hoặc
SELECT * FROM profiles LIMIT 1;
SELECT * FROM signals LIMIT 1;
```

### 2. Check Constraints

```sql
-- Phone number phải NOT NULL
\d profiles

-- Kết quả phải có:
-- phone_number | text | not null
```

### 3. Check Functions

```sql
-- Test function
SELECT get_display_name(auth.uid());

-- Test permissions
SELECT can_access_feature('signals');  -- false (Free user)
SELECT can_access_feature('dashboard'); -- true (Free user)
```

### 4. Test Trigger

```sql
-- Trigger sẽ tự động tạo profile khi insert vào auth.users
-- Test bằng cách đăng ký user mới qua app
```

---

## 🔧 Schema Overview

```
profiles
├── id (uuid, PK, FK auth.users)
├── email (text, NOT NULL, unique)           ⭐ BẮT BUỘC
├── phone_number (text, NOT NULL)            ⭐ BẮT BUỘC
├── full_name (text)
├── nickname (text)                          ⭐ Tên hiển thị
├── stock_account_number (text)
├── avatar_url (text)
├── zalo_id (text, unique)
├── membership (text, default 'free')
├── membership_expires_at (timestamptz)
├── tcbs_api_key (text)
├── tcbs_connected_at (timestamptz)
├── created_at (timestamptz)
└── updated_at (timestamptz)

Constraints:
- nickname: 2-50 chars
- phone_number: 9-20 chars, format ^[0-9+\-\s()]{9,20}$
- membership: 'free' | 'premium'
```

---

## 🎯 Permissions (Free vs Premium)

### Free Tier

✅ **Có quyền truy cập**:
- Tổng quan (`dashboard`)
- Cổ phiếu (`stocks`)
- Thị trường (`market`)
- Cá nhân (`profile`)

❌ **Không có quyền**:
- Tín hiệu (`signals`)
- Phân tích AI (`ai-analysis`)
- Danh mục (`portfolio`)
- Cảnh báo (`alerts`)

### Premium Tier

✅ **Có quyền truy cập TẤT CẢ**

---

## 🧪 Test Cases

### Test 1: Tạo User Mới

```sql
-- Profile sẽ tự động được tạo khi user đăng ký
-- Check:
SELECT * FROM profiles WHERE email = 'new-user@example.com';
```

### Test 2: Update Nickname

```sql
SELECT update_my_nickname('My Nickname');

-- Verify:
SELECT nickname FROM profiles WHERE id = auth.uid();
```

### Test 3: Upgrade to Premium

```sql
UPDATE profiles
SET membership = 'premium',
    membership_expires_at = NOW() + INTERVAL '1 year'
WHERE id = auth.uid();

-- Test access:
SELECT can_access_feature('signals');  -- true (Premium user)
```

### Test 4: Phone Validation

```sql
-- Invalid phone (too short) - sẽ lỗi
UPDATE profiles
SET phone_number = '123'
WHERE id = auth.uid();
-- ERROR: phone_format_check

-- Valid phone
UPDATE profiles
SET phone_number = '0901234567'
WHERE id = auth.uid();
-- SUCCESS ✅
```

---

## 🚨 Troubleshooting

### Lỗi: "relation already exists"

**Nguyên nhân**: Table đã tồn tại từ lần chạy trước.

**Giải pháp**: Script sử dụng `IF NOT EXISTS`, nên chạy lại an toàn. Hoặc drop table nếu muốn recreate:

```sql
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS signals CASCADE;
-- Chạy lại script
```

### Lỗi: "function does not exist" khi gọi từ TypeScript

**Nguyên nhân**: Script chưa chạy hoặc chạy không thành công.

**Giải pháp**:
1. Check logs trong SQL Editor
2. Chạy lại script
3. Verify: `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';`

### Lỗi: "violates row-level security policy"

**Nguyên nhân**: RLS policies chưa được tạo đúng.

**Giải pháp**:
```sql
-- Check policies
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Chạy lại script từ STEP 6 trở đi
```

---

## 📂 Files Liên Quan

```
scripts/
├── supabase-sync-complete.sql      ⭐ SCRIPT CHÍNH (run này)
├── supabase-auth-profile-setup.sql   (backup - same content)
└── README_SYNC.md                    (tài liệu này)

docs/
├── QUICK_SETUP.md                    (hướng dẫn chi tiết)
├── PROFILE_FIELDS_UPDATE.md          (update phone_number)
└── PERMISSIONS_GUIDE.md              (phân quyền Free/Premium)
```

---

## 🎯 Next Steps

Sau khi chạy script thành công:

1. ✅ **Test đăng ký/đăng nhập Zalo**
   ```
   User đăng nhập → Profile tự động tạo
   ```

2. ✅ **Test phân quyền**
   ```typescript
   import { canAccessFeature, FEATURES } from '@/lib/permissions'
   await canAccessFeature(FEATURES.SIGNALS)  // false (Free)
   ```

3. ✅ **Protect Premium pages**
   ```typescript
   import { withFeatureAccess } from '@/components/withFeatureAccess'
   export default withFeatureAccess(SignalsPage)
   ```

4. ✅ **Update UI**
   - Thêm input phone_number vào profile page
   - Thêm input nickname
   - Hiển thị membership status
   - Add upgrade button cho Free users

---

## 📚 Tài Liệu Đầy Đủ

- **Profile Fields**: `docs/PROFILE_FIELDS_UPDATE.md`
- **Permissions**: `docs/PERMISSIONS_GUIDE.md`
- **Quick Setup**: `docs/QUICK_SETUP.md`

---

## ✅ Checklist

- [ ] Copy script `supabase-sync-complete.sql`
- [ ] Chạy trong Supabase SQL Editor
- [ ] Thấy "Success" message
- [ ] Verify tables tồn tại (`profiles`, `signals`)
- [ ] Verify functions (13 functions)
- [ ] Test `get_my_accessible_features()`
- [ ] Test đăng ký user mới
- [ ] Test update nickname
- [ ] Test phân quyền Free/Premium
- [ ] Update code TypeScript (nếu cần)

---

**Tạo bởi**: CPLS Development Team
**Version**: 1.0
**Ngày**: 2025-11-14

Script sẵn sàng để copy vào Supabase! 🚀
