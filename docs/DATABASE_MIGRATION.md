# Database Migration Guide - CPLS

Hướng dẫn chi tiết cách chạy database migration cho Supabase.

## 📋 Tổng quan

Có 3 SQL scripts chính:

| File | Mục đích | Khi nào dùng |
|------|----------|--------------|
| `supabase_migration.sql` | ✅ Chạy migration chính | Lần đầu setup database |
| `supabase_verify.sql` | 🔍 Kiểm tra schema | Sau khi chạy migration |
| `supabase_rollback.sql` | ⏪ Rollback migration | Nếu cần revert changes |

---

## 🚀 Quick Start (Recommended)

### Bước 1: Chạy Migration

1. Đăng nhập vào **Supabase Dashboard**: https://app.supabase.com
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng database ở sidebar)
4. Click **"New query"**
5. Copy toàn bộ nội dung từ file **`supabase_migration.sql`**
6. Paste vào SQL Editor
7. Click **"Run"** (hoặc Ctrl/Cmd + Enter)

### Bước 2: Verify Migration

1. Trong SQL Editor, tạo query mới
2. Copy toàn bộ nội dung từ file **`supabase_verify.sql`**
3. Paste và **"Run"**
4. Kiểm tra output - tất cả phải có ✓ (checkmark)

### Bước 3: Xác nhận trong Table Editor

1. Vào **Table Editor** > **profiles**
2. Kiểm tra các columns mới:
   - ✅ `full_name`
   - ✅ `phone_number`
   - ✅ `stock_account_number`
   - ✅ `avatar_url`
   - ✅ `zalo_id`
   - ✅ `membership`
   - ✅ `membership_expires_at`
   - ✅ `updated_at`

---

## 📝 Chi tiết Migration Script

### `supabase_migration.sql` làm gì?

```
Part 1: Pre-migration checks
  ✓ Verify table exists
  ✓ Count existing records

Part 2: Backup existing data
  ✓ Count current users

Part 3: Add new columns
  ✓ full_name, phone_number, stock_account_number
  ✓ avatar_url, zalo_id
  ✓ membership, membership_expires_at
  ✓ updated_at

Part 4: Add constraints
  ✓ UNIQUE on zalo_id
  ✓ CHECK on membership (free/premium only)

Part 5: Migrate existing data
  ✓ Convert role → membership
    - 'user' → 'free'
    - 'vip' → 'premium'
  ✓ Drop old 'role' column

Part 6: Create indexes
  ✓ idx_profiles_zalo_id
  ✓ idx_profiles_phone_number
  ✓ idx_profiles_membership
  ✓ idx_profiles_email

Part 7: Create functions & triggers
  ✓ update_updated_at_column() function
  ✓ Auto-update updated_at trigger

Part 8: Row Level Security (RLS)
  ✓ Enable RLS on profiles table
  ✓ Users can view own profile
  ✓ Users can update own profile
  ✓ Users can insert own profile
  ✓ Users can delete own profile

Part 9: Grant permissions
  ✓ Grant SELECT, INSERT, UPDATE, DELETE to authenticated

Part 10: Post-migration verification
  ✓ Verify all columns exist
  ✓ Verify indexes created
  ✓ Verify RLS enabled

Part 11: Final summary
  ✓ Display statistics
  ✓ Show next steps
```

### Output mẫu

Khi chạy thành công, bạn sẽ thấy:

```
NOTICE:  ✓ Table "profiles" exists
NOTICE:  ✓ Current profiles table has 8 columns
NOTICE:  ✓ Found 0 existing user records
NOTICE:  ✓ Added new columns
NOTICE:  ✓ Added unique constraint on zalo_id
NOTICE:  ✓ Added check constraint on membership
NOTICE:  ✓ No "role" column to migrate
NOTICE:  ✓ Created performance indexes
NOTICE:  ✓ Created triggers for updated_at
NOTICE:  ✓ Created Row Level Security policies
NOTICE:  ✓ Granted permissions to authenticated users
NOTICE:  ✓ All required columns exist
NOTICE:  ✓ Created 7 indexes on profiles table
NOTICE:  ✓ Row Level Security is enabled
NOTICE:  ✓ Created 4 RLS policies

NOTICE:  ╔════════════════════════════════════════════════════════╗
NOTICE:  ║          MIGRATION COMPLETED SUCCESSFULLY             ║
NOTICE:  ╚════════════════════════════════════════════════════════╝
```

---

## 🔍 Verification Script

### `supabase_verify.sql` làm gì?

Kiểm tra toàn diện schema:

```
Check 1: Table exists
Check 2: All required columns exist with correct types
Check 3: Constraints (UNIQUE, CHECK)
Check 4: Indexes
Check 5: Row Level Security policies
Check 6: Triggers
Check 7: Functions
Check 8: Data integrity
Check 9: Permissions
Final Summary
```

### Khi nào chạy Verify?

- ✅ Sau khi chạy migration lần đầu
- ✅ Sau khi deploy code mới
- ✅ Định kỳ để audit database
- ✅ Khi debug issues

---

## ⏪ Rollback Script (Cẩn thận!)

### `supabase_rollback.sql` - ⚠️ CHỈ DÙNG KHI CẦN

**⚠️ CẢNH BÁO:**
- Script này sẽ **XÓA DỮ LIỆU**
- Tất cả Zalo linked accounts sẽ bị unlink
- User profile data sẽ bị mất
- **KHÔNG THỂ UNDO!**

### Khi nào cần rollback?

- ❌ Migration failed và corrupt data
- ❌ Phát hiện bug nghiêm trọng sau migration
- ❌ Cần revert về version cũ

### Cách chạy Rollback (An toàn)

1. **Backup trước:**
   ```sql
   CREATE TABLE profiles_backup_emergency AS SELECT * FROM profiles;
   ```

2. **Mở file `supabase_rollback.sql`**

3. **Đọc kỹ warnings**

4. **Uncomment các dòng code** (bỏ `--` ở đầu)

5. **Run từng section một** (không run toàn bộ file)

6. **Verify sau mỗi section**

### Soft Rollback (Khuyến nghị)

Thay vì xóa columns, chỉ clear data:

```sql
-- Unlink tất cả Zalo accounts
UPDATE profiles SET zalo_id = NULL;

-- Revert tất cả về Free
UPDATE profiles SET membership = 'free' WHERE membership = 'premium';

-- Clear expiration dates
UPDATE profiles SET membership_expires_at = NULL;
```

---

## 📊 Database Schema

### Before Migration

```sql
profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  role TEXT CHECK (role IN ('user','vip')),
  created_at TIMESTAMPTZ
)
```

### After Migration

```sql
profiles (
  -- Existing
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ,

  -- User Profile
  full_name TEXT,
  phone_number TEXT,
  stock_account_number TEXT,
  avatar_url TEXT,

  -- Zalo Integration
  zalo_id TEXT UNIQUE,

  -- Membership System
  membership TEXT DEFAULT 'free' CHECK (membership IN ('free','premium')),
  membership_expires_at TIMESTAMPTZ,

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

Indexes:
  - idx_profiles_zalo_id
  - idx_profiles_phone_number
  - idx_profiles_membership
  - idx_profiles_email

Triggers:
  - update_profiles_updated_at (auto-update updated_at on UPDATE)

RLS Policies:
  - Users can view own profile
  - Users can update own profile
  - Users can insert own profile
  - Users can delete own profile
```

---

## 🔧 Troubleshooting

### Issue 1: "Table profiles does not exist"

**Nguyên nhân:** Chưa tạo table profiles

**Giải pháp:**
```sql
-- Chạy schema.sql trước
-- hoặc tạo table thủ công:

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Issue 2: "Column already exists"

**Nguyên nhân:** Migration đã chạy rồi

**Giải pháp:**
- Migration script sử dụng `IF NOT EXISTS` nên an toàn để chạy lại
- Hoặc chạy `supabase_verify.sql` để kiểm tra trạng thái

### Issue 3: "Permission denied"

**Nguyên nhân:** Không có quyền admin trên Supabase

**Giải pháp:**
- Đăng nhập với account owner của project
- Hoặc contact admin để grant permissions

### Issue 4: Migration chạy nhưng không có output

**Nguyên nhân:** Supabase SQL Editor không hiện NOTICE messages mặc định

**Giải pháp:**
- Check phần "Results" ở dưới editor
- Hoặc query table để verify:
  ```sql
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'profiles';
  ```

### Issue 5: RLS blocking queries

**Nguyên nhân:** RLS enabled nhưng policies chưa đúng

**Giải pháp:**
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Temporarily disable RLS for debugging (KHÔNG dùng trong production!)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable after fixing
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

---

## ✅ Checklist

Trước khi deploy app:

- [ ] Chạy `supabase_migration.sql` thành công
- [ ] Chạy `supabase_verify.sql` - tất cả checks pass
- [ ] Kiểm tra Table Editor - thấy columns mới
- [ ] RLS enabled và có 4 policies
- [ ] Indexes đã được tạo
- [ ] Trigger `update_profiles_updated_at` hoạt động
- [ ] Test query:
  ```sql
  -- Should return all new columns
  SELECT * FROM profiles LIMIT 1;
  ```

---

## 📚 References

- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/trigger-definition.html)
- [Migration Best Practices](https://supabase.com/docs/guides/database/migrations)

---

## 🆘 Support

Nếu gặp vấn đề:

1. Chạy `supabase_verify.sql` để identify issue
2. Check Supabase Dashboard > Logs
3. Search error message trong docs
4. Contact support với:
   - Error message
   - Output của verify script
   - Screenshot của Table Editor

---

## 🎯 Summary

**Files:**
- ✅ `supabase_migration.sql` - Run once to setup
- 🔍 `supabase_verify.sql` - Run anytime to check
- ⏪ `supabase_rollback.sql` - Emergency only

**Process:**
1. Run migration
2. Verify success
3. Deploy app
4. Test Zalo login

**Safety:**
- Migration uses `IF NOT EXISTS` - safe to re-run
- Backup recommended before rollback
- RLS protects user data

**Ready to deploy!** 🚀
