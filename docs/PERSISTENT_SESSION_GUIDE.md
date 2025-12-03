# Persistent Session Management - Hướng dẫn chi tiết

## 📋 Tổng quan

Hệ thống session được thiết kế để **user không bị logout trên trình duyệt cũ**, chỉ logout khi:
1. Đăng nhập từ thiết bị mới (nếu đạt giới hạn)
2. Không hoạt động quá **3 ngày**

## 🎯 Yêu cầu

- ✅ User trên trình duyệt cũ tiếp tục dùng không bị logout
- ✅ Chỉ logout khi không active quá 3 ngày
- ✅ Nhận diện thiết bị qua device fingerprint
- ✅ Session persistent across browser restarts
- ✅ Không giới hạn số lượng devices

## 🔧 Cách hoạt động

### 1. Device Fingerprint

**Device fingerprint** được tạo từ các đặc điểm của browser:
- User Agent
- Screen resolution
- Timezone
- Hardware concurrency
- Canvas fingerprint
- Platform, vendor...

Fingerprint được lưu trong `localStorage` với key `cpls_device_fingerprint`.

**Code:** `lib/session-manager.ts` → `getDeviceFingerprint()`

### 2. Session Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│  Login trên Device A                                     │
├─────────────────────────────────────────────────────────┤
│  1. Generate/get device fingerprint                      │
│  2. Check user_sessions table:                           │
│     - Tìm session với same fingerprint                   │
│     - Nếu có:                                            │
│       * Check last_activity                              │
│       * Nếu < 3 days → Keep session (không logout)      │
│       * Nếu > 3 days → Logout                           │
│     - Nếu không có:                                      │
│       * Tạo session record mới                           │
│  3. Update last_activity                                 │
│  4. Start activity tracking                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Sử dụng app                                             │
├─────────────────────────────────────────────────────────┤
│  - User click, scroll, type → Update last_activity      │
│  - Every hour → Check if inactive > 3 days              │
│  - Tab becomes visible → Refresh session check          │
│  - JWT expires → Auto-refresh token                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Đóng browser và mở lại (trong 3 ngày)                  │
├─────────────────────────────────────────────────────────┤
│  1. Get device fingerprint from localStorage             │
│  2. Find session with same fingerprint                   │
│  3. Check last_activity < 3 days → ✅ Keep logged in    │
│  4. Update last_activity                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Không active quá 3 ngày                                 │
├─────────────────────────────────────────────────────────┤
│  - Hourly check phát hiện: last_activity > 3 days       │
│  - Mark session.is_active = false                        │
│  - Sign out from Supabase                                │
│  - Redirect to /login                                    │
└─────────────────────────────────────────────────────────┘
```

### 3. Database Schema

Table: `user_sessions`

```sql
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  session_token text UNIQUE,

  -- Device identification
  fingerprint text,          -- Device fingerprint for persistent recognition
  device_name text,
  device_type text,
  browser text,
  os text,

  -- Activity tracking
  last_activity timestamptz,  -- Updated on every user action
  expires_at timestamptz,     -- 90 days from creation

  -- Status
  is_active boolean,
  created_at timestamptz
);
```

### 4. Activity Tracking

Activities được track:
- `click` - User clicks anywhere
- `keypress` - User types
- `scroll` - User scrolls
- `mousemove` - User moves mouse
- `focus` - Window gains focus
- `visibilitychange` - Tab becomes visible

Mỗi activity → Update `last_activity` timestamp.

### 5. Inactivity Check

**Check interval:** Every 1 hour

**Logic:**
```typescript
const timeSinceActivity = Date.now() - lastActivityRef.current
const INACTIVITY_TIMEOUT = 3 * 24 * 60 * 60 * 1000 // 3 days

if (timeSinceActivity > INACTIVITY_TIMEOUT) {
  // Logout user
  await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

  await supabase.auth.signOut()
  window.location.href = '/login'
}
```

## 📊 Scenarios

### Scenario 1: User đăng nhập lần đầu

1. User login on **Device A** (Chrome on Windows)
2. Generate fingerprint: `fp_abc123xyz`
3. Create session record:
   ```json
   {
     "fingerprint": "fp_abc123xyz",
     "device_name": "Chrome on Windows",
     "last_activity": "2025-12-03T10:00:00Z",
     "expires_at": "2026-03-03T10:00:00Z", // 90 days
     "is_active": true
   }
   ```
4. User sử dụng app → last_activity continuously updated

### Scenario 2: User đóng browser và mở lại (sau 1 ngày)

1. User mở browser again on **Device A**
2. Get fingerprint from localStorage: `fp_abc123xyz`
3. Find session with fingerprint `fp_abc123xyz`
4. Check last_activity: `2025-12-03T10:00:00Z` (1 day ago)
5. ✅ < 3 days → **Keep logged in**, không cần login lại
6. Update last_activity to now

### Scenario 3: User không active quá 3 ngày

1. User last active: `2025-12-03T10:00:00Z`
2. Current time: `2025-12-07T10:00:00Z` (4 days later)
3. User mở app
4. Check last_activity: 4 days ago > 3 days
5. ❌ **Logout automatically**
6. Redirect to `/login`

### Scenario 4: User đăng nhập trên device mới

1. User login on **Device B** (Safari on macOS)
2. Generate new fingerprint: `fp_def456uvw`
3. No existing session with this fingerprint
4. Create **NEW** session record
5. **Device A session vẫn active** (không bị logout!)

## 🔒 Security Features

### 1. Device Recognition

- Persistent fingerprint in localStorage
- Canvas fingerprinting for uniqueness
- Multiple device characteristics

### 2. Activity Monitoring

- Real-time activity tracking
- Hourly inactivity checks
- Automatic session cleanup

### 3. Session Expiry

- JWT expires: 8 hours (auto-refresh)
- Session record expires: 90 days
- Inactive logout: 3 days

### 4. Database Security

- Row Level Security (RLS) enabled
- Users can only see own sessions
- Session tokens are unique

## 🧪 Testing

### Test 1: Persistent Login

```bash
# 1. Login on browser
# 2. Close browser completely
# 3. Wait 1-2 minutes
# 4. Open browser again
# Expected: Still logged in ✅
```

### Test 2: Inactivity Logout

```bash
# 1. Login
# 2. Don't touch app for 3+ days (or adjust INACTIVITY_TIMEOUT for testing)
# 3. Come back after 3 days
# Expected: Logged out automatically ✅
```

### Test 3: Multiple Devices

```bash
# 1. Login on Chrome
# 2. Login on Firefox
# Expected: Both stay logged in ✅
```

### Test 4: Activity Tracking

```bash
# 1. Login
# 2. Run in console: getSessionInfo()
# 3. Wait 1 minute without activity
# 4. Run getSessionInfo() again
# Expected: daysSinceActivity increases ✅
# 5. Click anywhere
# 6. Run getSessionInfo() again
# Expected: daysSinceActivity resets to 0 ✅
```

## 🐛 Debugging

### Console Helper

Run this in browser console:
```javascript
getSessionInfo()
```

Output:
```
┌─────────────────────┬────────────────────────────────┐
│ user                │ user@example.com               │
│ jwtExpiresAt        │ 12/3/2025, 6:00:00 PM         │
│ timeUntilExpiry     │ 7h 55m                        │
│ deviceFingerprint   │ fp_abc123xyz                  │
│ lastActivity        │ 12/3/2025, 10:00:00 AM        │
│ daysSinceActivity   │ 0.05                          │
│ willLogoutAt        │ 12/6/2025, 10:00:00 AM        │
└─────────────────────┴────────────────────────────────┘
```

### Logs to Watch

```
✅ [PersistentSessionManager] Found existing session for this device
⏰ [PersistentSessionManager] Session expires in 475 minutes
🔄 [PersistentSessionManager] Token refreshed successfully
⏰ [PersistentSessionManager] Inactive for 3+ days - logging out
```

### Database Queries

Check active sessions:
```sql
SELECT
  device_name,
  fingerprint,
  last_activity,
  EXTRACT(EPOCH FROM (NOW() - last_activity)) / 86400 AS days_since_activity,
  is_active
FROM user_sessions
WHERE user_id = 'your-user-id'
ORDER BY last_activity DESC;
```

## 📝 Configuration

### Adjust Inactivity Timeout

File: `components/PersistentSessionManager.tsx`

```typescript
// Change from 3 days to X days
const INACTIVITY_TIMEOUT = X * 24 * 60 * 60 * 1000
```

### Adjust Session Expiry

File: `lib/session-manager.ts`

```typescript
// Change from 90 days to X days
expires_at: new Date(Date.now() + X * 24 * 60 * 60 * 1000).toISOString()
```

### Adjust Activity Check Interval

File: `components/PersistentSessionManager.tsx`

```typescript
// Change from 1 hour to X minutes
checkIntervalRef.current = setInterval(async () => {
  // ...
}, X * 60 * 1000)
```

## 🚀 Deployment

### Supabase Setup

1. Run migration:
   ```sql
   -- File: migrations/create_sessions_table.sql
   -- Đã có sẵn, chỉ cần chạy trong Supabase SQL Editor
   ```

2. Verify table created:
   ```sql
   SELECT * FROM user_sessions LIMIT 1;
   ```

### Vercel Setup

Không cần thêm env vars mới. Chỉ cần deploy code.

## ⚠️ Important Notes

1. **Fingerprint là persistent**: Lưu trong localStorage, không thay đổi khi restart browser
2. **90 days session limit**: Sau 90 ngày phải login lại (hard limit)
3. **3 days inactivity**: Soft limit, logout nếu không active
4. **No device limit**: User có thể login unlimited devices
5. **Old SessionManager**: File `components/SessionManager.tsx` vẫn còn nhưng không được sử dụng nữa

## 📚 Files Changed

- ✅ `components/PersistentSessionManager.tsx` - Main session manager
- ✅ `lib/session-manager.ts` - Device fingerprint & session utilities
- ✅ `app/layout.tsx` - Use PersistentSessionManager
- ✅ `migrations/create_sessions_table.sql` - Database schema (existing)

---

**Updated:** 2025-12-03
**For:** CPLS Project
**Feature:** Persistent session with 3-day inactivity logout
