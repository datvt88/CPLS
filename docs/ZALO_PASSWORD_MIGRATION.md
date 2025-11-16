# Zalo OAuth Password Migration Guide

## Vấn đề

Sau khi update code Zalo OAuth, password format đã thay đổi:

### Password cũ (có thể thay đổi):
```typescript
`zalo_${zaloUser.id}_secure_password_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10)}`
```

### Password mới (cố định):
```typescript
`zalo_oauth_${zaloUser.id}_cpls_secure_2024`
```

**Hậu quả**: User cũ (đã đăng nhập trước đây) sẽ không login được nữa vì password đã thay đổi.

## Giải pháp

Chạy migration script để reset tất cả password về format mới.

---

## Cách 1: Migration Script (Khuyến nghị)

### Bước 1: Chuẩn bị Environment Variables

Tạo file `.env.local` hoặc set environment variables:

```bash
# Supabase Config
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# IMPORTANT: Service Role Key (Admin access)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**⚠️ Lưu ý**:
- `SUPABASE_SERVICE_ROLE_KEY` có quyền admin, **TUYỆT ĐỐI** không commit lên Git
- Lấy key tại: Supabase Dashboard → Settings → API → service_role key

### Bước 2: Install Dependencies

```bash
npm install @supabase/supabase-js
npm install --save-dev ts-node @types/node
```

### Bước 3: Chạy Migration Script

```bash
npx ts-node scripts/migrate-zalo-passwords.ts
```

**Output mẫu**:
```
🔧 Starting Zalo Password Migration...

📋 Step 1: Fetching all Zalo users...
✅ Found 15 Zalo users

🔄 Step 2: Updating passwords...

✅ Updated: zalo_1234567890@cpls.app (user_id: abc12345...)
✅ Updated: zalo_9876543210@cpls.app (user_id: def67890...)
...

============================================================
📊 MIGRATION SUMMARY
============================================================
Total Zalo users: 15
✅ Successfully updated: 15
❌ Failed: 0

✨ Migration completed!
```

### Bước 4: Verify Migration

Chạy script verify để kiểm tra:

```bash
npx ts-node scripts/verify-zalo-users.ts
```

**Output mẫu**:
```
🔍 Verifying Zalo Users...

Found 15 Zalo users

✅ Can login: zalo_1234567890@cpls.app
✅ Can login: zalo_9876543210@cpls.app
...

============================================================
📊 VERIFICATION SUMMARY
============================================================
Total users: 15
✅ Can login: 15
❌ Cannot login: 0

✨ Verification completed!
```

---

## Cách 2: SQL Script (Alternative)

Nếu không muốn dùng TypeScript, có thể dùng SQL trực tiếp trên Supabase.

### ⚠️ Hạn chế:
- **KHÔNG THỂ** update password qua SQL trực tiếp vì Supabase Auth sử dụng bcrypt hash
- Phải dùng Supabase Admin API (như script trên)

### Workaround: Delete & Recreate

**Chỉ nên dùng nếu**:
- Ít users (< 10)
- Không cần giữ lịch sử user

```sql
-- CẢNH BÁO: Script này sẽ XÓA tất cả Zalo users!
-- Họ sẽ phải đăng ký lại lần đầu

-- Step 1: Backup profiles
CREATE TABLE profiles_backup AS
SELECT * FROM profiles WHERE email LIKE 'zalo_%@cpls.app';

-- Step 2: Delete auth users (sẽ cascade delete profiles)
-- KHÔNG THỂ làm qua SQL - phải dùng Supabase Dashboard hoặc Admin API

-- Step 3: User sẽ tự động tạo lại khi login lần tiếp theo
```

**Không khuyến nghị vì**: User mất tất cả data, membership, settings...

---

## Cách 3: Manual Reset (Cho từng user)

Nếu chỉ có vài users bị lỗi:

1. Vào **Supabase Dashboard** → Authentication → Users
2. Tìm user có email `zalo_XXXXX@cpls.app`
3. Click vào user → **Send Password Reset Email**
4. User nhận email → Đặt password mới

**⚠️ Vấn đề**:
- Email `zalo_XXXXX@cpls.app` không tồn tại, không nhận được email
- Phải dùng Admin API để force reset password

---

## Recommended Workflow

### Production Migration

```bash
# 1. Backup database trước
pg_dump your_database > backup_before_migration.sql

# 2. Test trên staging/local trước
export NEXT_PUBLIC_SUPABASE_URL="https://staging.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="staging_service_key"
npx ts-node scripts/migrate-zalo-passwords.ts

# 3. Verify staging
npx ts-node scripts/verify-zalo-users.ts

# 4. Nếu OK, chạy trên production
export NEXT_PUBLIC_SUPABASE_URL="https://prod.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="prod_service_key"
npx ts-node scripts/migrate-zalo-passwords.ts

# 5. Verify production
npx ts-node scripts/verify-zalo-users.ts
```

---

## Troubleshooting

### Issue 1: "Missing environment variables"

**Cause**: Chưa set `SUPABASE_SERVICE_ROLE_KEY`

**Fix**:
```bash
# Get service_role key from Supabase Dashboard
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
```

### Issue 2: "Failed to update user: User not found"

**Cause**: User đã bị xóa khỏi Auth nhưng vẫn còn trong profiles table

**Fix**:
```sql
-- Clean up orphaned profiles
DELETE FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users);
```

### Issue 3: Migration script timeout

**Cause**: Quá nhiều users (> 100)

**Fix**: Thêm delay giữa các updates
```typescript
// In migrate-zalo-passwords.ts
await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay
```

---

## Prevention (Tương lai)

Để tránh vấn đề này trong tương lai:

### 1. Sử dụng Supabase OAuth Provider

Thay vì tự implement password-based auth, dùng Supabase OAuth:

```typescript
// Instead of signInWithPassword
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'custom', // Custom OAuth provider
  options: {
    redirectTo: `${window.location.origin}/auth/callback`
  }
})
```

### 2. Store Password Salt riêng

```typescript
// Store in environment variable (NEVER change)
const PASSWORD_SALT = process.env.ZALO_PASSWORD_SALT || 'cpls_default_salt_2024'
const password = `zalo_oauth_${zaloId}_${PASSWORD_SALT}`
```

### 3. Migration Script trong CI/CD

Add migration script vào deployment pipeline:

```yaml
# .github/workflows/deploy.yml
- name: Run migrations
  run: |
    npx ts-node scripts/migrate-zalo-passwords.ts
```

---

## FAQs

### Q: Có cần chạy migration script nhiều lần không?

**A**: Không. Chỉ chạy 1 lần sau khi update code. Users mới sẽ tự động dùng password format mới.

### Q: User đang login có bị logout không?

**A**: Không. Active sessions không bị ảnh hưởng. Chỉ ảnh hưởng khi họ login lại.

### Q: Mất bao lâu để migrate?

**A**: ~0.5-1 giây/user. Với 100 users: ~1-2 phút.

### Q: Có rollback được không?

**A**: Không. Password đã bị overwrite. Nhưng có thể chạy lại migration với password format cũ nếu cần.

---

## Summary

✅ **DO**:
- Backup database trước khi migrate
- Test trên staging trước
- Verify sau khi migrate
- Use migration script (TypeScript)

❌ **DON'T**:
- Commit service_role key lên Git
- Skip verification step
- Delete users manually
- Chạy migration trên production mà chưa test

---

## Script Files

- `scripts/migrate-zalo-passwords.ts` - Migration script
- `scripts/verify-zalo-users.ts` - Verification script
- `docs/ZALO_PASSWORD_MIGRATION.md` - Documentation (file này)

---

**Last Updated**: 2025-01-16
**Author**: Claude AI Assistant
