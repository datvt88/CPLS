# Zalo OAuth Scripts

Utility scripts để quản lý Zalo OAuth users.

## Scripts

### 1. `list-zalo-users.ts`
Liệt kê tất cả Zalo users

```bash
npx ts-node scripts/list-zalo-users.ts
```

### 2. `migrate-zalo-passwords.ts`
Reset password cho tất cả Zalo users về format mới

```bash
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
npx ts-node scripts/migrate-zalo-passwords.ts
```

### 3. `verify-zalo-users.ts`
Verify tất cả Zalo users có thể login

```bash
npx ts-node scripts/verify-zalo-users.ts
```

## Setup

```bash
npm install @supabase/supabase-js ts-node @types/node
```

**Environment Variables**:
```bash
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
```

⚠️ **NEVER commit SUPABASE_SERVICE_ROLE_KEY!**

---

📖 **Chi tiết**: [ZALO_PASSWORD_MIGRATION.md](../docs/ZALO_PASSWORD_MIGRATION.md)
