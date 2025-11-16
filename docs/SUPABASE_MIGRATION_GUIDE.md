# Hướng Dẫn Chạy Migrations Trên Supabase

## ✅ CÓ! Bạn CẦN chạy SQL migrations trong Supabase SQL Editor

Các migrations này thêm columns mới vào database để hỗ trợ Zalo OAuth.

---

## 📋 Tóm tắt

**Migrations cần chạy**:
1. ✅ Thêm columns: `zalo_id`, `full_name`, `birthday`, `gender`, `avatar_url`, etc.
2. ✅ Tạo indexes cho performance
3. ✅ Setup RLS policies cho security
4. ✅ Tạo auto-update trigger cho `updated_at`
5. ✅ Migrate từ `role` sang `membership` system

**Thời gian**: ~10-30 giây

---

## 🚀 Quick Start (3 Bước)

### Bước 1: Copy Script

Mở file: [`migrations/COMPLETE_ZALO_MIGRATION.sql`](../migrations/COMPLETE_ZALO_MIGRATION.sql)

**Hoặc** copy từ đây:

<details>
<summary>📄 Click để xem script (copy toàn bộ)</summary>

```sql
-- [Script content sẽ được copy từ COMPLETE_ZALO_MIGRATION.sql]
-- Xem file migrations/COMPLETE_ZALO_MIGRATION.sql
```

</details>

### Bước 2: Chạy Trong Supabase

1. Đăng nhập [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng `</>` ở sidebar trái)
4. Click **New Query**
5. Paste script vào
6. Click **Run** (hoặc `Ctrl+Enter` / `Cmd+Enter`)
7. Đợi ~10-30 giây

### Bước 3: Verify

**Cách 1: Check Output**

Sau khi chạy, bạn sẽ thấy output:

```
✅ ZALO OAUTH MIGRATION COMPLETED SUCCESSFULLY!
============================================================================

Summary:
  ✓ Added 13 columns to profiles table
  ✓ Created 4 indexes for performance
  ✓ Setup 3 RLS policies for security
  ✓ Created auto-update trigger for updated_at
  ✓ Migrated old role system to membership system

New fields:
  • full_name, phone_number, nickname
  • avatar_url, stock_account_number
  • zalo_id (UNIQUE)
  • birthday (DD/MM/YYYY format)
  • gender (male/female)
  • membership (free/premium)
  • updated_at (auto-updated)
```

**Cách 2: Run Verification Script**

Copy và chạy [`migrations/VERIFY_MIGRATION.sql`](../migrations/VERIFY_MIGRATION.sql) trong SQL Editor

Expected output:
```
🎉 VERIFICATION PASSED - Migration is complete!
```

---

## 📖 Chi Tiết Các Migrations

### Migration 1: Basic User Fields

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stock_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

**Tại sao cần**:
- Lưu thông tin cá nhân user
- Hỗ trợ tính năng profile management

---

### Migration 2: Zalo OAuth Fields

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zalo_id TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));
```

**Tại sao cần**:
- `zalo_id`: Unique identifier từ Zalo (bắt buộc cho Zalo users)
- `birthday`: Ngày sinh từ Zalo (DD/MM/YYYY format)
- `gender`: Giới tính từ Zalo (male/female)

**Mapping**:
| Zalo API | Database Column |
|----------|-----------------|
| `id` | `zalo_id` |
| `name` | `full_name` |
| `birthday` | `birthday` |
| `gender` | `gender` |
| `picture.data.url` | `avatar_url` |

---

### Migration 3: Membership System

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership TEXT DEFAULT 'free' CHECK (membership IN ('free','premium'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMPTZ;
```

**Tại sao cần**:
- Thay thế hệ thống `role` cũ (user/vip) bằng `membership` (free/premium)
- Hỗ trợ membership expiration date
- Better naming convention

**Auto-migration**:
- Script tự động convert `role='user'` → `membership='free'`
- Script tự động convert `role='vip'` → `membership='premium'`

---

### Migration 4: Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_membership ON profiles(membership);
CREATE INDEX IF NOT EXISTS idx_profiles_nickname ON profiles(nickname);
```

**Tại sao cần**:
- Tăng tốc query lookup by zalo_id
- Optimize search by phone_number
- Filter by membership nhanh hơn

---

### Migration 5: RLS Policies

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

**Tại sao cần**:
- Bảo mật: Users chỉ thấy/sửa profile của chính họ
- Prevent unauthorized access
- Required by Supabase best practices

---

### Migration 6: Auto-Update Trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Tại sao cần**:
- Tự động update `updated_at` mỗi khi profile được sửa
- Track last modification time
- Useful cho audit và sync

---

## ⚠️ Quan Trọng

### Safe to Run Multiple Times

✅ Script sử dụng `IF NOT EXISTS` - an toàn khi chạy nhiều lần:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zalo_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_zalo_id ON profiles(zalo_id);
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
```

Nghĩa là:
- Nếu column/index/policy đã tồn tại → Skip
- Nếu chưa tồn tại → Create
- Không có errors nếu chạy lại

### Không Mất Data

✅ Migrations chỉ **THÊM** columns, không **XÓA** hay **SỬA** data hiện có:

- ✅ Existing profiles giữ nguyên tất cả data
- ✅ Chỉ thêm columns mới (với giá trị NULL hoặc default)
- ✅ Auto-migration cho role → membership

### Backup Recommended

⚠️ Dù script an toàn, vẫn nên backup trước:

**Option 1: Supabase Auto-Backup**
- Supabase tự động backup daily
- Recovery qua Dashboard

**Option 2: Manual Backup**
```bash
pg_dump your_database > backup_before_migration.sql
```

---

## 🔍 Verification

### Method 1: Check Columns

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

Expected output sẽ có các columns:
- `zalo_id` (text, nullable)
- `full_name` (text, nullable)
- `birthday` (text, nullable)
- `gender` (text, nullable)
- `avatar_url` (text, nullable)
- `membership` (text, not nullable, default 'free')
- `updated_at` (timestamp with time zone)

### Method 2: Check Indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'profiles'
ORDER BY indexname;
```

Expected output:
- `idx_profiles_zalo_id`
- `idx_profiles_phone_number`
- `idx_profiles_membership`
- `idx_profiles_nickname`

### Method 3: Check RLS Policies

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles';
```

Expected output:
- `Users can view own profile` (SELECT)
- `Users can update own profile` (UPDATE)
- `Users can insert own profile` (INSERT)

### Method 4: Run Verification Script

Chạy [`migrations/VERIFY_MIGRATION.sql`](../migrations/VERIFY_MIGRATION.sql)

---

## 🐛 Troubleshooting

### Error: "relation 'profiles' does not exist"

**Cause**: Table `profiles` chưa được tạo

**Fix**:
1. Check xem bạn đã chạy initial schema chưa
2. Hoặc chạy `schema.sql` trước
3. Hoặc tạo table profiles manually

### Error: "permission denied for table profiles"

**Cause**: User không có quyền ALTER table

**Fix**:
1. Đảm bảo bạn đang login với đúng account
2. Hoặc run script với Supabase service role

### Warning: "role column does not exist"

**Message**: `ℹ No role column found - skipping migration`

**Fix**: Không cần fix - đây là expected nếu bạn chưa có column `role` cũ

### Some columns already exist

**Message**: `column "zalo_id" of relation "profiles" already exists`

**Fix**: Không cần fix - script sẽ skip columns đã tồn tại (IF NOT EXISTS)

---

## 📝 Summary Checklist

Sau khi chạy migrations, check:

- [ ] ✅ Chạy `COMPLETE_ZALO_MIGRATION.sql` thành công
- [ ] ✅ Thấy success message trong output
- [ ] ✅ Verify bằng `VERIFY_MIGRATION.sql` → PASSED
- [ ] ✅ Check columns exist trong Table Editor
- [ ] ✅ Check indexes exist
- [ ] ✅ Check RLS policies exist

Nếu tất cả ✅, database của bạn đã sẵn sàng cho Zalo OAuth! 🎉

---

## 🚀 Next Steps

Sau khi migrations xong:

1. **Deploy Next.js app** với Zalo OAuth code
2. **Configure Zalo Developer Console**:
   - Callback URL: `https://yourdomain.com/auth/callback`
   - App ID và App Secret
3. **Set environment variables**:
   ```bash
   NEXT_PUBLIC_ZALO_APP_ID=your_app_id
   ZALO_APP_SECRET=your_app_secret
   ```
4. **Test login** với Zalo
5. **Run verification script** để check field sync:
   ```bash
   npx ts-node scripts/verify-zalo-field-sync.ts
   ```

---

## 📚 Related Documentation

- [Zalo Field Mapping](./ZALO_FIELD_MAPPING.md) - Field mapping guide
- [Zalo Auth Setup](./ZALO_AUTH_SETUP.md) - Complete setup guide
- [Zalo Password Migration](./ZALO_PASSWORD_MIGRATION.md) - Password migration

---

## 📞 Support

Nếu gặp vấn đề:

1. Check troubleshooting section above
2. Run verification script
3. Check Supabase logs
4. Contact support với logs/errors

---

**Last Updated**: 2025-01-16
**Version**: 1.0.0
