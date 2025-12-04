# Hệ Thống Đăng Nhập và Phân Quyền - CPLS

## 📋 Mục Lục
1. [Tổng Quan](#tổng-quan)
2. [Sơ Đồ Luồng Đăng Nhập](#sơ-đồ-luồng-đăng-nhập)
3. [Sơ Đồ Phân Quyền](#sơ-đồ-phân-quyền)
4. [Chi Tiết Các Component](#chi-tiết-các-component)
5. [Các File Quan Trọng](#các-file-quan-trọng)

---

## 🎯 Tổng Quan

Hệ thống sử dụng **Supabase Auth** làm nền tảng với 3 phương thức đăng nhập:
- **Phone/Email + Password** (Supabase native auth)
- **Google OAuth** (Supabase provider)
- **Zalo OAuth** (Custom implementation với PKCE)

Phân quyền người dùng gồm 2 cấp:
- **Role**: `user`, `mod`, `admin`
- **Membership**: `free`, `premium`

---

## 📊 Sơ Đồ Luồng Đăng Nhập

```
┌─────────────────────────────────────────────────────────────────┐
│                        NGƯỜI DÙNG                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ╔════════════════════════════════════════╗
        ║       Trang /login (AuthForm)          ║
        ╠════════════════════════════════════════╣
        ║  [1] Phone + Password                  ║
        ║  [2] Google OAuth Button               ║
        ║  [3] Zalo OAuth Button (PKCE)          ║
        ╚════════════════════════════════════════╝
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐    ┌──────────┐    ┌──────────┐
   │ Phone   │    │  Google  │    │   Zalo   │
   │  Auth   │    │  OAuth   │    │  OAuth   │
   └────┬────┘    └─────┬────┘    └─────┬────┘
        │               │                │
        │         ┌─────┴────────────────┘
        │         │
        └─────────┤
                  ▼
     ╔═══════════════════════════════════════╗
     ║     /auth/callback (OAuth Handler)    ║
     ╠═══════════════════════════════════════╣
     ║  • Verify OAuth code                  ║
     ║  • Exchange for session token         ║
     ║  • Set cookies + localStorage         ║
     ╚═══════════════════════════════════════╝
                  │
                  ▼
     ╔═══════════════════════════════════════╗
     ║      AuthListener (Auto-start)        ║
     ╠═══════════════════════════════════════╣
     ║  [1] Sync user profile to DB          ║
     ║  [2] Create session record            ║
     ║  [3] Start keepalive (50 min)         ║
     ║  [4] Start activity tracking (5 min)  ║
     ║  [5] Cleanup expired sessions         ║
     ╚═══════════════════════════════════════╝
                  │
                  ▼
     ╔═══════════════════════════════════════╗
     ║  PersistentSessionManager (30 days)   ║
     ╠═══════════════════════════════════════╣
     ║  • Token refresh (before expiry)      ║
     ║  • Device fingerprint tracking        ║
     ║  • Max 3 devices enforcement          ║
     ║  • Auto-logout if 30 days inactive    ║
     ╚═══════════════════════════════════════╝
                  │
                  ▼
            ┌──────────┐
            │ DASHBOARD│
            └──────────┘
```

---

## 🔐 Sơ Đồ Phân Quyền và Route Protection

```
┌─────────────────────────────────────────────────────────────────┐
│                   USER NAVIGATES TO ROUTE                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ╔════════════════════════════════════════╗
        ║      ConditionalLayout Check           ║
        ╠════════════════════════════════════════╣
        ║  "/" → No header/sidebar               ║
        ║  "/login", "/register" → Header only   ║
        ║  Other → Full layout (Header + Sidebar)║
        ╚════════════════════════════════════════╝
                         │
                         ▼
        ╔════════════════════════════════════════╗
        ║       Route Protection Check           ║
        ╚════════════════════════════════════════╝
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   ┌─────────┐    ┌──────────┐    ┌──────────┐
   │ Public  │    │Protected │    │  Admin   │
   │ Route   │    │  Route   │    │  Route   │
   └────┬────┘    └─────┬────┘    └─────┬────┘
        │               │                │
        ▼               ▼                ▼
   ┌─────────┐    ╔══════════╗    ╔══════════╗
   │ Grant   │    ║ Check    ║    ║ Check    ║
   │ Access  │    ║ Session? ║    ║ Role?    ║
   └─────────┘    ╚════╤═════╝    ╚════╤═════╝
                       │               │
                  ┌────┴────┐     ┌────┴────┐
                  │         │     │         │
                  ▼         ▼     ▼         ▼
              ╔═════╗   ╔═════╗ ╔════╗   ╔═════╗
              ║ YES ║   ║ NO  ║ ║ADMIN║   ║USER ║
              ╚══╤══╝   ╚══╤══╝ ║ /MOD║   ╚══╤══╝
                 │         │    ╚══╤══╝      │
                 ▼         ▼       │         ▼
         ╔═══════════╗     │       ▼    ╔════════╗
         ║ Premium?  ║     │   ╔═════╗  ║Redirect║
         ╚═════╤═════╝     │   ║Grant║  ║  to    ║
               │           │   ║Access║ ║/dash   ║
          ┌────┴────┐      │   ╚═════╝  ╚════════╝
          │         │      │
          ▼         ▼      ▼
      ╔═════╗   ╔═════╗╔══════╗
      ║ YES ║   ║ NO  ║║Redirect║
      ╚══╤══╝   ╚══╤══╝║ to    ║
         │         │   ║/login ║
         ▼         ▼   ╚══════╝
    ╔════════╗ ╔═════╗
    ║ Check  ║ ║Grant║
    ║Expired?║ ║Access║
    ╚════╤═══╝ ╚═════╝
         │
    ┌────┴────┐
    │         │
    ▼         ▼
╔═════╗   ╔═════╗
║Valid║   ║Expired║
╚══╤══╝   ╚══╤══╝
   │         │
   ▼         ▼
╔═════╗ ╔══════╗
║Grant║ ║Redirect║
║Access║║  to   ║
╚═════╝ ║/upgrade║
        ╚══════╝
```

---

## 🏗️ Chi Tiết Các Component

### 1. **AuthListener** (`components/AuthListener.tsx`)
**Nhiệm vụ**: Lắng nghe thay đổi auth state và khởi tạo session

```typescript
Auth Events → SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
    ↓
Actions:
  [1] syncUserProfile() → Upsert profiles table
  [2] createSessionRecord() → Insert user_sessions
  [3] startSessionKeepalive() → Refresh token every 50 min
  [4] startActivityTracking() → Update last_activity every 5 min
  [5] cleanupExpiredSessions() → Remove old sessions
```

**Khi nào chạy**: Tự động trong Root Layout, chạy mọi page

---

### 2. **PersistentSessionManager** (`components/PersistentSessionManager.tsx`)
**Nhiệm vụ**: Quản lý session 30 ngày với device tracking

```typescript
Features:
  • 30-day persistent login (không bị logout khi đóng browser)
  • Device fingerprinting (canvas + browser info)
  • Max 3 devices (xóa device cũ nhất khi vượt)
  • Auto-logout nếu không hoạt động 30 ngày
  • Token refresh 5 phút trước khi hết hạn

Tracking Events:
  • click, keypress, scroll, mousemove → Update lastActivity
  • Tab visibility change → Re-check session
  • Window focus → Update activity
```

**Khi nào chạy**: Tự động trong Root Layout

---

### 3. **ProtectedRoute** (`components/ProtectedRoute.tsx`)
**Nhiệm vụ**: Bảo vệ route yêu cầu auth + optional premium

```typescript
Props:
  • requirePremium?: boolean → Yêu cầu membership = 'premium'

Flow:
  [1] Check session exists → Redirect /login if no
  [2] If requirePremium = true:
      - Query profiles.membership
      - Check membership_expires_at > now
      - Redirect /upgrade if not premium or expired
  [3] Grant access

Safety Features:
  • 5-second timeout (tránh infinite loading)
  • Retry logic (2 attempts) cho new user profile sync
  • hasValidSession flag để tránh false redirects
```

**Cách dùng**:
```tsx
<ProtectedRoute>
  <MyPage />
</ProtectedRoute>

// Hoặc yêu cầu premium
<ProtectedRoute requirePremium>
  <PremiumFeaturePage />
</ProtectedRoute>
```

---

### 4. **AdminRoute** (`components/AdminRoute.tsx`)
**Nhiệm vụ**: Chỉ cho phép admin/mod truy cập

```typescript
Check: profile.role === 'admin' || profile.role === 'mod'
  → YES: Grant access
  → NO: Redirect to /dashboard
```

**Cách dùng**:
```tsx
<AdminRoute>
  <AdminDashboard />
</AdminRoute>
```

---

### 5. **ProtectedFeature** (`components/ProtectedFeature.tsx`)
**Nhiệm vụ**: Feature-level permission check

```typescript
Props:
  • feature: 'signals' | 'ai-analysis' | 'portfolio' | 'alerts'

Check: canAccessFeature(userId, feature) via RPC
  → YES: Render children
  → NO: Show upgrade prompt
```

**Cách dùng**:
```tsx
<ProtectedFeature feature="signals">
  <SignalsChart />
</ProtectedFeature>
```

---

## 🔑 User Roles & Permissions

### **User Roles** (profile.role)
```typescript
type UserRole = 'user' | 'mod' | 'admin'
```

| Role    | Quyền                                                |
|---------|------------------------------------------------------|
| `user`  | Truy cập dashboard, features theo membership        |
| `mod`   | Như admin + access to /admin                         |
| `admin` | Full access + quản lý users + update memberships     |

### **Membership Tiers** (profile.membership)
```typescript
type MembershipTier = 'free' | 'premium'
```

| Tier      | Features                                                    |
|-----------|-------------------------------------------------------------|
| `free`    | Dashboard, Market, Stocks, Profile, limited Signals        |
| `premium` | All free features + AI Analysis, Portfolio, Alerts, Signals |

### **Feature Permissions** (`lib/permissions.ts`)
```typescript
FREE_FEATURES = ['dashboard', 'stocks', 'market', 'profile', 'signals']
PREMIUM_FEATURES = ['ai-analysis', 'portfolio', 'alerts']

Functions:
  • canAccessFeature(userId, feature) → Call Supabase RPC
  • isPremiumUser(userId) → Check membership === 'premium'
  • getAccessibleFeatures(userId) → List all accessible features
```

---

## 📁 Các File Quan Trọng

### **Core Services**
```
services/
  ├── auth.service.ts           # Sign in/up/out, OAuth, device management
  ├── profile.service.ts        # User profiles, roles, membership
  └── device.service.ts         # Device tracking & fingerprinting
```

### **Auth Components**
```
components/
  ├── AuthListener.tsx          # Auth state listener (50 min keepalive)
  ├── PersistentSessionManager.tsx  # 30-day session manager
  ├── ProtectedRoute.tsx        # Route protection (auth + premium)
  ├── AdminRoute.tsx            # Admin-only route protection
  ├── AuthForm.tsx              # Login/register form
  ├── GoogleLoginButton.tsx     # Google OAuth button
  ├── ZaloLoginButton.tsx       # Zalo OAuth button (PKCE)
  ├── ProtectedFeature.tsx      # Feature-level protection
  └── withFeatureAccess.tsx     # HOC for feature access
```

### **Lib/Utils**
```
lib/
  ├── supabaseClient.ts         # Supabase client + cookie storage
  ├── permissions.ts            # Feature permission checks
  ├── session-manager.ts        # Session CRUD operations
  └── pkce.ts                   # PKCE utilities for OAuth
```

### **API Routes**
```
app/api/auth/
  ├── signin-phone/route.ts     # Phone → email lookup
  ├── zalo/authorize/route.ts   # Generate Zalo auth URL
  ├── zalo/token/route.ts       # Exchange code for token
  └── zalo/user/route.ts        # Get Zalo user info
```

### **Auth Pages**
```
app/
  ├── login/page.tsx            # Login page
  ├── auth/callback/page.tsx    # OAuth callback handler
  ├── upgrade/page.tsx          # Premium upgrade page
  └── admin/page.tsx            # Admin dashboard
```

---

## 🔄 Session Flow Chi Tiết

### **Khi User Login**
```
1. User nhập thông tin → AuthForm component
2. Call authService.signInWithPhone() hoặc OAuth
3. Supabase tạo session → Set cookies + localStorage
4. Redirect to /auth/callback (OAuth) hoặc /dashboard (phone)
5. AuthListener triggers:
   - syncUserProfile() → Upsert profiles table
   - createSessionRecord() → Insert user_sessions
   - startSessionKeepalive() → 50 min refresh interval
   - startActivityTracking() → 5 min activity update
6. PersistentSessionManager triggers:
   - Device fingerprint generation
   - Check existing sessions (max 3 devices)
   - Schedule token refresh (5 min before expiry)
   - Start inactivity checker (logout after 30 days)
```

### **Khi User Navigate Protected Route**
```
1. Component wrapped in <ProtectedRoute>
2. Check session via supabase.auth.getSession()
   → No session? Redirect /login
3. If requirePremium = true:
   - Query profiles.membership
   - Check membership_expires_at
   → Not premium or expired? Redirect /upgrade
4. Grant access, render children
```

### **Khi User Logout**
```
1. Call authService.signOut()
2. AuthListener catches SIGNED_OUT event:
   - Stop keepalive interval
   - Stop activity tracking
3. PersistentSessionManager catches SIGNED_OUT:
   - Clear refresh timer
   - Clear inactivity checker
4. Mark session as inactive in user_sessions
5. Clear cookies + localStorage
6. Redirect to /login
```

---

## 🛡️ Security Features

### **1. PKCE for OAuth**
- Code verifier + challenge cho Zalo OAuth
- Prevents authorization code interception

### **2. Device Fingerprinting**
- Canvas fingerprint + browser characteristics
- Detect device changes

### **3. Token Refresh**
- 50-min keepalive (tokens expire after 60 min)
- 5-min margin before expiry (PersistentSessionManager)

### **4. Activity Tracking**
- Update last_activity every 5 minutes
- Auto-logout after 30 days inactivity

### **5. Device Limit**
- Max 3 devices per user
- Auto-remove oldest device when limit reached

### **6. Cookie + Storage Dual Persistence**
- Cookies for SSR/API routes
- localStorage for client-side
- Survives browser restarts

---

## 🎨 Navigation theo User Types

### **Free User** (membership = 'free')
```
✅ Dashboard, Market, Stocks, Profile
❌ Signals (show upgrade prompt)
❌ AI Analysis (redirect /upgrade)
❌ Portfolio (redirect /upgrade)
```

### **Premium User** (membership = 'premium')
```
✅ All free features
✅ Signals (full access)
✅ AI Analysis
✅ Portfolio, Alerts
🏆 "Premium" badge displayed
```

### **Admin/Mod** (role = 'admin' | 'mod')
```
✅ Access to /admin dashboard
✅ Can update user roles via profileService.updateUserRole()
✅ Can set/unset premium via updateUserMembershipByAdmin()
✅ View user stats via getUserStats()
```

---

## 📊 Database Tables

### **profiles**
```sql
- id (uuid, PK)
- email (text)
- full_name (text)
- avatar_url (text)
- phone_number (text)
- role (text) → 'user' | 'mod' | 'admin'
- membership (text) → 'free' | 'premium'
- membership_expires_at (timestamp)
- provider (text) → 'email' | 'google' | 'zalo'
```

### **user_sessions**
```sql
- id (uuid, PK)
- user_id (uuid, FK → auth.users)
- session_token (text) → JWT access token
- device_name (text) → Browser/OS info
- fingerprint (text) → Device fingerprint
- ip_address (text)
- last_activity (timestamp)
- is_active (boolean)
- expires_at (timestamp)
```

### **user_devices**
```sql
- id (uuid, PK)
- user_id (uuid, FK → auth.users)
- fingerprint (text, unique)
- device_name (text)
- last_seen (timestamp)
- is_active (boolean)
```

---

## 🚀 Best Practices

### **Khi Tạo Protected Page**
```tsx
// Good ✅
export default function MyPage() {
  return (
    <ProtectedRoute requirePremium>
      <MyPageContent />
    </ProtectedRoute>
  )
}

// Bad ❌ - Không wrap, ai cũng access được
export default function MyPage() {
  return <MyPageContent />
}
```

### **Khi Check Feature Permission**
```tsx
// Good ✅ - Dùng ProtectedFeature component
<ProtectedFeature feature="signals">
  <SignalsChart />
</ProtectedFeature>

// Bad ❌ - Hardcode membership check
{user?.membership === 'premium' && <SignalsChart />}
```

### **Khi Admin Operation**
```tsx
// Good ✅ - Check qua profileService
const isAdmin = await profileService.isAdminOrMod(profile)
if (isAdmin) {
  await profileService.updateUserRole(userId, 'mod')
}

// Bad ❌ - Direct database update
await supabase.from('profiles').update({ role: 'mod' })
```

---

## 🐛 Debugging

### **Check Session trong Console**
```javascript
// In browser console:
getSessionInfo()
// Returns: user, expiry time, device fingerprint, last activity
```

### **Auth State Logs**
Auth events được log ra console:
```
✅ Session found - user@email.com
🔐 Session keepalive started (refresh every 50 min)
📊 Activity tracking started (update every 5 min)
🔄 Refreshing session...
✅ Token refreshed successfully
```

### **Common Issues**

**Issue**: Infinite redirect loop
```
Fix: Check ProtectedRoute safety timeout (5s)
     Check hasValidSession flag
```

**Issue**: Profile not synced
```
Fix: Wait for AuthListener to sync (1-2s after login)
     Check profiles table for user ID
```

**Issue**: Token expired
```
Fix: Check keepalive running (should refresh every 50 min)
     Check PersistentSessionManager refresh timer
```

---

**Tài liệu được tạo**: 2025-12-04
**Phiên bản**: 1.0
**Cần hỗ trợ**: Liên hệ team dev
