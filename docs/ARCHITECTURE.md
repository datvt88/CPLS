# CPLS Architecture - Zalo OAuth & User Management

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Next.js 15 Frontend                       │  │
│  │  • React 18 Components                                       │  │
│  │  • TypeScript                                                │  │
│  │  • Tailwind CSS                                              │  │
│  │  • next-themes (Dark/Light mode)                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Client-side Authentication                      │  │
│  │  • ZaloLoginButton (redirect to Zalo)                       │  │
│  │  • AuthForm (email/password)                                 │  │
│  │  • Session management                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                ↓ HTTPS
┌─────────────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE/SERVERLESS                           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 Next.js API Routes (Server-side)             │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  POST /api/auth/zalo/token                           │   │  │
│  │  │  • Exchange authorization code                       │   │  │
│  │  │  • Uses ZALO_APP_SECRET (server-only) 🔒            │   │  │
│  │  │  • Returns access_token                              │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  POST /api/auth/zalo/user                            │   │  │
│  │  │  • Fetch user info from Zalo                         │   │  │
│  │  │  • Returns: id, name, picture                        │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │           Environment Variables (Server-side)                │  │
│  │  • ZALO_APP_SECRET 🔒 (secret)                               │  │
│  │  • GEMINI_API_KEY 🔒 (secret)                                │  │
│  │  • NEXT_PUBLIC_* (public, safe for client)                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                    ↓                           ↓
         ┌──────────────────┐      ┌──────────────────────┐
         │   Zalo OAuth      │      │   Supabase           │
         │   API             │      │   (PostgreSQL)       │
         └──────────────────┘      └──────────────────────┘
```

---

## 🔐 Authentication Flow

### 1. Zalo OAuth Login Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │
     │ 1. Click "Đăng nhập với Zalo"
     ▼
┌─────────────────────────┐
│ ZaloLoginButton         │
│ (Client Component)      │
└────┬────────────────────┘
     │
     │ 2. Generate state (CSRF protection)
     │    store in sessionStorage
     │
     │ 3. Build OAuth URL
     │    https://oauth.zaloapp.com/v4/permission
     │    ?app_id=XXX
     │    &redirect_uri=.../auth/callback
     │    &state=random_string
     │
     │ 4. window.location.href = authUrl
     ▼
┌─────────────────────────┐
│  Zalo OAuth Server      │
│  oauth.zaloapp.com      │
└────┬────────────────────┘
     │
     │ 5. User authorizes app
     │
     │ 6. Redirect back with code + state
     ▼
┌─────────────────────────────────────┐
│  /auth/callback                     │
│  (Client Component)                 │
└────┬────────────────────────────────┘
     │
     │ 7. Verify state parameter
     │    (CSRF protection)
     │
     │ 8. POST /api/auth/zalo/token
     │    body: { code }
     ▼
┌─────────────────────────────────────┐
│  API Route: /api/auth/zalo/token    │
│  (Server-side - Vercel Edge)        │
└────┬────────────────────────────────┘
     │
     │ 9. Exchange code for access_token
     │    POST https://oauth.zaloapp.com/v4/access_token
     │    headers: { secret_key: ZALO_APP_SECRET } 🔒
     │
     │ 10. Return { access_token }
     ▼
┌─────────────────────────────────────┐
│  /auth/callback                     │
└────┬────────────────────────────────┘
     │
     │ 11. POST /api/auth/zalo/user
     │     body: { access_token }
     ▼
┌─────────────────────────────────────┐
│  API Route: /api/auth/zalo/user     │
│  (Server-side)                      │
└────┬────────────────────────────────┘
     │
     │ 12. GET https://graph.zalo.me/v2.0/me
     │     ?access_token=XXX&fields=id,name,picture
     │
     │ 13. Return { id, name, picture }
     ▼
┌─────────────────────────────────────┐
│  /auth/callback                     │
└────┬────────────────────────────────┘
     │
     │ 14. Create/login Supabase user
     │     email: zalo_{id}@cpls.app (pseudo-email)
     │     password: generated from zalo_id
     │
     │ 15. Create/update profile
     │     zalo_id, full_name, avatar_url
     │
     │ 16. Redirect to /dashboard
     ▼
┌──────────┐
│  User    │ ✅ Logged in
└──────────┘
```

---

## 📊 Database Schema (Supabase)

### Tables

#### `profiles` table

```sql
CREATE TABLE profiles (
  -- Identity
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,

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

  -- TCBS Integration (Future)
  tcbs_api_key TEXT,
  tcbs_connected_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_zalo_id ON profiles(zalo_id);
CREATE INDEX idx_profiles_phone_number ON profiles(phone_number);
CREATE INDEX idx_profiles_membership ON profiles(membership);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Auto-update trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

#### `signals` table

```sql
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  signal TEXT CHECK (signal IN ('BUY','SELL','HOLD')),
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can delete own profile
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);
```

---

## 🎨 Frontend Architecture

### Component Tree

```
app/
├── layout.tsx (RootLayout)
│   ├── Providers (ThemeProvider)
│   ├── AuthListener (global auth sync)
│   ├── Sidebar
│   │   ├── Link: Tổng quan (/dashboard)
│   │   ├── Link: Thị trường (/market)
│   │   ├── Link: Cổ phiếu (/stocks)
│   │   ├── Link: Tín hiệu (/signals) [Premium only]
│   │   └── Link: Cá nhân (/profile)
│   ├── Header
│   └── {children}
│
├── page.tsx (Home/Login)
│   └── AuthForm
│       ├── Email/Password inputs
│       ├── Login/Signup button
│       └── ZaloLoginButton
│
├── auth/callback/page.tsx (OAuth callback handler)
│   └── handleCallback()
│       ├── Verify state
│       ├── POST /api/auth/zalo/token
│       ├── POST /api/auth/zalo/user
│       ├── Create Supabase user
│       ├── Create/update profile
│       └── Redirect to /dashboard
│
├── dashboard/page.tsx
│   └── ProtectedRoute
│       └── Dashboard content
│
├── profile/page.tsx (Cá nhân)
│   └── ProtectedRoute
│       └── ProfilePageContent
│           ├── User Info Section
│           │   ├── Avatar
│           │   ├── Full name
│           │   ├── Phone number
│           │   └── Stock account number
│           ├── Membership Section
│           │   ├── Current plan (Free/Premium)
│           │   ├── Expiration date
│           │   └── Upgrade button
│           └── TCBS Integration Section
│               ├── API Key input (encrypted)
│               ├── Connection status
│               └── Test connection button
│
└── signals/page.tsx (Premium only)
    └── ProtectedRoute (requirePremium)
        └── AI Signals content
```

### Key Components

#### `ZaloLoginButton.tsx`

```typescript
export default function ZaloLoginButton() {
  const handleZaloLogin = async () => {
    // Generate CSRF state
    const state = generateRandomString()
    sessionStorage.setItem('zalo_oauth_state', state)

    // Build OAuth URL
    const authUrl = new URL('https://oauth.zaloapp.com/v4/permission')
    authUrl.searchParams.set('app_id', NEXT_PUBLIC_ZALO_APP_ID)
    authUrl.searchParams.set('redirect_uri', `${origin}/auth/callback`)
    authUrl.searchParams.set('state', state)

    // Redirect to Zalo
    window.location.href = authUrl.toString()
  }

  return <button onClick={handleZaloLogin}>Đăng nhập với Zalo</button>
}
```

#### `ProtectedRoute.tsx`

```typescript
export default function ProtectedRoute({
  children,
  requirePremium = false
}) {
  useEffect(() => {
    // Check auth
    const { session } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    // Check premium if required
    if (requirePremium) {
      const { profile } = await profileService.getProfile(session.user.id)
      const isPremium = profile.membership === 'premium' &&
                        (!profile.membership_expires_at ||
                         new Date(profile.membership_expires_at) > new Date())

      if (!isPremium) {
        router.push('/upgrade')
        return
      }
    }

    setAllowed(true)
  }, [])

  if (!allowed) return <LoadingSpinner />
  return <>{children}</>
}
```

---

## 🔧 Services Architecture

### `auth.service.ts`

```typescript
export const authService = {
  // Email/Password auth
  signUp({ email, password })
  signIn({ email, password })
  signOut()

  // Zalo OAuth (deprecated - now handled by API routes)
  signInWithZalo(options?)

  // Session management
  getSession()
  getUser()
  getUserMetadata()
  onAuthStateChange(callback)

  // OAuth callback
  handleOAuthCallback()
}
```

### `profile.service.ts`

```typescript
export const profileService = {
  // Profile CRUD
  getProfile(userId)
  upsertProfile(profileData)
  updateProfile(userId, updates)

  // Membership
  isPremium(userId)
  updateMembership(userId, membership, expiresAt?)

  // Zalo integration
  getProfileByZaloId(zaloId)
  linkZaloAccount(userId, zaloId, zaloData?)

  // TCBS integration (future)
  updateTCBSApiKey(userId, apiKey)
  testTCBSConnection(userId)

  // Backward compatibility
  isVIP(userId)  // @deprecated
  updateRole(userId, role)  // @deprecated
}
```

---

## 🔐 Security Architecture

### Environment Variables Security

| Variable | Type | Location | Purpose |
|----------|------|----------|---------|
| `NEXT_PUBLIC_ZALO_APP_ID` | Public | Client + Server | Initialize OAuth |
| `ZALO_APP_SECRET` | **Secret** | Server only | Token exchange |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Client + Server | Supabase connection |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Client + Server | RLS-protected queries |
| `GEMINI_API_KEY` | **Secret** | Server only | AI signals |

### Security Layers

```
┌─────────────────────────────────────────────┐
│  Layer 1: Transport Security                │
│  • HTTPS enforced (Vercel automatic)        │
│  • Security headers (X-Frame-Options, etc)  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 2: CSRF Protection                   │
│  • State parameter in OAuth                 │
│  • Verified in callback                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 3: Secret Management                 │
│  • ZALO_APP_SECRET never exposed to client │
│  • Token exchange on server-side only      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 4: Authentication                    │
│  • Supabase Auth (JWT tokens)              │
│  • Session persistence with auto-refresh   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 5: Authorization                     │
│  • Row Level Security (RLS) in Supabase    │
│  • Membership checks (Free/Premium)        │
│  • ProtectedRoute wrapper                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Layer 6: Input Validation                  │
│  • Email/password format validation        │
│  • XSS sanitization                        │
│  • SQL injection prevention (Supabase ORM) │
└─────────────────────────────────────────────┘
```

---

## 📱 User Management Flow

### User Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│  1. REGISTRATION                                         │
│                                                          │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐       │
│  │ Zalo     │ OR  │ Email/   │  →  │ Supabase │       │
│  │ OAuth    │     │ Password │     │ Auth     │       │
│  └──────────┘     └──────────┘     └────┬─────┘       │
│                                           │              │
│                                           ▼              │
│                                   ┌──────────────┐      │
│                                   │ auth.users   │      │
│                                   │ table        │      │
│                                   └──────┬───────┘      │
│                                          │              │
│                                          ▼              │
│                        AuthListener triggers            │
│                                          │              │
│                                          ▼              │
│                                   ┌──────────────┐      │
│                                   │ profiles     │      │
│                                   │ table        │      │
│                                   │ - id         │      │
│                                   │ - email      │      │
│                                   │ - membership │      │
│                                   │   = 'free'   │      │
│                                   └──────────────┘      │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  2. PROFILE COMPLETION                                   │
│                                                          │
│  User visits /profile (Cá nhân)                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Profile Form                                       │ │
│  │ • Full name                                        │ │
│  │ • Phone number                                     │ │
│  │ • Stock account number                             │ │
│  │ • TCBS API key (optional)                          │ │
│  └────────────────────────────────────────────────────┘ │
│                        ↓                                 │
│              profileService.updateProfile()              │
│                        ↓                                 │
│                 profiles table updated                   │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  3. MEMBERSHIP UPGRADE (Optional)                        │
│                                                          │
│  User clicks "Nâng cấp Premium"                         │
│                        ↓                                 │
│              Contact admin / Payment flow                │
│                        ↓                                 │
│      Admin updates: membership = 'premium'               │
│                      membership_expires_at = +30 days    │
│                        ↓                                 │
│         User can access /signals (Premium content)       │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  4. ONGOING USAGE                                        │
│                                                          │
│  Free User:                    Premium User:             │
│  ✓ Dashboard                   ✓ All Free features      │
│  ✓ Market data                 ✓ AI Signals (/signals)  │
│  ✓ Stock charts                ✓ Advanced analytics     │
│  ✓ Profile management          ✓ Priority support       │
│  ✗ AI Signals (blocked)                                 │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  5. DATA SYNC                                            │
│                                                          │
│  Zalo users:                                             │
│  • Avatar auto-synced from Zalo                         │
│  • Name updated on each login (if changed)              │
│                                                          │
│  TCBS integration (future):                              │
│  • API key stored encrypted                              │
│  • Auto-fetch portfolio data                             │
│  • Sync holdings daily                                   │
└──────────────────────────────────────────────────────────┘
```

---

## 🌐 API Routes Architecture

### `/api/auth/zalo/token` (POST)

**Purpose:** Exchange authorization code for access token (server-side)

**Security:** Uses `ZALO_APP_SECRET` (never exposed to client)

```typescript
// Request
POST /api/auth/zalo/token
Content-Type: application/json

{
  "code": "authorization_code_from_zalo"
}

// Response
200 OK
{
  "access_token": "zalo_access_token",
  "expires_in": 3600
}

// Error
400 Bad Request
{
  "error": "Failed to exchange authorization code"
}
```

### `/api/auth/zalo/user` (POST)

**Purpose:** Fetch user info from Zalo Graph API

```typescript
// Request
POST /api/auth/zalo/user
Content-Type: application/json

{
  "access_token": "zalo_access_token"
}

// Response
200 OK
{
  "id": "zalo_user_id",
  "name": "Nguyễn Văn A",
  "picture": "https://..."
}

// Error
400 Bad Request
{
  "error": "Failed to fetch user information"
}
```

---

## 🔄 Data Flow Diagrams

### Profile Update Flow

```
User edits profile
      ↓
ProfilePage (client)
      ↓
profileService.updateProfile(userId, updates)
      ↓
Supabase client library
      ↓
[RLS Check: auth.uid() = userId?]
      ↓ YES
UPDATE profiles SET ... WHERE id = userId
      ↓
[Trigger: update_updated_at_column()]
      ↓
profiles.updated_at = NOW()
      ↓
Return updated profile
      ↓
UI updates automatically
```

### Membership Check Flow

```
User visits /signals
      ↓
ProtectedRoute (requirePremium=true)
      ↓
Check session exists
      ↓ YES
profileService.isPremium(userId)
      ↓
Query: SELECT membership, membership_expires_at
       FROM profiles WHERE id = userId
      ↓
Check: membership = 'premium'?
      ↓ YES
Check: membership_expires_at > NOW()?
      ↓ YES
Allow access to /signals
      ↓ NO
Redirect to /upgrade
```

---

## 📦 Technology Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **UI Library:** React 18
- **Styling:** Tailwind CSS 3.4
- **Theme:** next-themes
- **Charts:** lightweight-charts

### Backend/API
- **Platform:** Vercel Edge Functions
- **Runtime:** Node.js 18+
- **API Routes:** Next.js API Routes

### Database
- **Provider:** Supabase (PostgreSQL)
- **ORM:** Supabase JavaScript Client
- **Auth:** Supabase Auth (JWT)

### External APIs
- **OAuth:** Zalo OAuth 2.0
- **AI:** Google Gemini API
- **Stock Data:** VNDirect API
- **Future:** TCBS API

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                   GitHub Repository                  │
│                   datvt88/CPLS                       │
└────────────────────┬────────────────────────────────┘
                     │ git push
                     ▼
┌─────────────────────────────────────────────────────┐
│                 Vercel Platform                      │
│  ┌───────────────────────────────────────────────┐ │
│  │  Build Process                                │ │
│  │  • npm install                                │ │
│  │  • npm run build                              │ │
│  │  • Environment variables injected             │ │
│  └───────────────────────────────────────────────┘ │
│                     ↓                                │
│  ┌───────────────────────────────────────────────┐ │
│  │  Production Deployment                        │ │
│  │  • Edge Functions (API routes)                │ │
│  │  • Static assets (CDN)                        │ │
│  │  • Serverless functions                       │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│  Supabase Cloud  │    │  External APIs   │
│  • PostgreSQL    │    │  • Zalo OAuth    │
│  • Auth          │    │  • Gemini AI     │
│  • Storage       │    │  • VNDirect      │
└──────────────────┘    └──────────────────┘
```

---

## 📈 Scalability Considerations

### Current Capacity
- **Frontend:** Vercel Edge (globally distributed)
- **API Routes:** Serverless (auto-scales)
- **Database:** Supabase (managed, scalable)

### Growth Plan
1. **0-1,000 users:** Current architecture sufficient
2. **1,000-10,000 users:**
   - Add Redis caching (Vercel KV)
   - Implement rate limiting
3. **10,000+ users:**
   - Database read replicas
   - CDN optimization
   - Background job queue

---

## 🔮 Future Enhancements

### Phase 1 (Current)
- ✅ Zalo OAuth authentication
- ✅ User profile management
- ✅ Membership system (Free/Premium)
- ✅ Secure server-side token exchange

### Phase 2 (Next)
- 🔄 TCBS API integration
  - Store API key encrypted
  - Fetch portfolio holdings
  - Display real-time assets
- 🔄 Payment integration (VNPay/Stripe)
  - Auto-upgrade to Premium
  - Subscription management

### Phase 3 (Future)
- 📋 Email notifications
- 📋 Webhook integrations
- 📋 Admin dashboard
- 📋 Analytics and reporting

---

## 📚 References

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Zalo OAuth Documentation](https://developers.zalo.me/docs)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

**Version:** 1.0
**Last Updated:** 2025-01-07
**Maintainer:** CPLS Development Team
