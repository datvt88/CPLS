# CPLS - Cổ Phiếu Lướt Sóng

Trading dashboard built with Next.js 15 + Supabase + Gemini AI + RBAC

## 🚀 Quick Start

### 1. Check Supabase Setup

```bash
npm run check-setup
```

If you see errors, follow the instructions below.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
# Copy example file
cp .env.local.example .env.local
```

Then edit `.env.local` and fill in your credentials:

- **NEXT_PUBLIC_SUPABASE_URL**: Get from Supabase Dashboard → Settings → API
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Get from Supabase Dashboard → Settings → API
- **SUPABASE_SERVICE_ROLE_KEY**: Get from Supabase Dashboard → Settings → API
- **GEMINI_API_KEY**: Get from Google AI Studio (optional)

📖 **Detailed setup guide**: See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)

### 4. Setup Database

Run the SQL in `schema.sql` in Supabase SQL Editor to create tables.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run check-setup` - Check Supabase configuration

## 📚 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **AI**: Google Gemini API
- **UI**: TailwindCSS + Material-UI
- **Auth**: Supabase Auth (Email/Password, Google OAuth, Phone)
- **Charts**: Lightweight Charts
- **Session**: Persistent sessions with device fingerprinting

## ⏱️ Persistent Session Management

The app uses **intelligent session management** that keeps users logged in on their existing browsers indefinitely, only logging out when necessary.

### Key Features:
- ✅ **Persistent login** on existing browsers (no re-login required)
- ✅ **Device fingerprinting** for browser recognition
- ✅ **3-day inactivity timeout** (automatic logout if no activity)
- ✅ **90-day session lifetime** (maximum)
- ✅ **Unlimited devices** (no device limit)
- ✅ **Auto-refresh tokens** every 8 hours
- ✅ **Activity tracking** (click, scroll, type, etc.)

### How It Works:

**Existing Browser:**
- Login once → Stay logged in forever (until inactive 3+ days)
- Close browser → Reopen → ✅ Still logged in
- Works across browser restarts

**New Browser/Device:**
- Login creates new session
- Does NOT logout other devices
- All devices stay active

**Inactivity Logout:**
- No activity for 3+ days → Automatic logout
- Activity = any click, scroll, type, mousemove

### Quick Check:

Run in browser console after login:
```javascript
getSessionInfo()
```

Output shows:
```
✓ Device fingerprint: fp_abc123xyz
✓ Last activity: Just now
✓ Days since activity: 0.00
✓ Will logout at: [3 days from now]
```

### Configuration:

**Supabase Dashboard:**
1. Go to Settings → Authentication
2. Set **JWT Expiry** to `28800` seconds (8 hours)
3. Set **Refresh Token Expiry** to `7776000` seconds (90 days)

**Adjust Inactivity Timeout:**
See `components/PersistentSessionManager.tsx`:
```typescript
const INACTIVITY_TIMEOUT = 3 * 24 * 60 * 60 * 1000 // 3 days
```

📖 **Detailed guide**: [docs/PERSISTENT_SESSION_GUIDE.md](./docs/PERSISTENT_SESSION_GUIDE.md)

## 🐛 Troubleshooting

### Login fails with "Đăng nhập thất bại"

**Cause**: Missing or invalid Supabase credentials

**Fix:**

**For Local Development:**
1. Run `npm run check-setup`
2. Create `.env.local` file
3. Add Supabase credentials
4. See [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md)

**For Vercel Production:**
1. Check `/api/health` endpoint: `https://your-app.vercel.app/api/health`
2. If unhealthy, go to Vercel Dashboard → Settings → Environment Variables
3. Add required environment variables
4. **Redeploy** (Vercel doesn't auto-rebuild on env var changes!)
5. See [Vercel setup guide](./SETUP_INSTRUCTIONS.md#-hướng-dẫn-cho-vercel-production-quan-trọng)

### "Missing NEXT_PUBLIC_SUPABASE_URL"

**Cause**: `.env.local` file not created (local) or env vars not set (Vercel)

**Fix for Local:**
```bash
cp .env.local.example .env.local
# Then edit .env.local with real credentials
```

**Fix for Vercel:**
- Go to Vercel Dashboard → Settings → Environment Variables
- Add all required variables
- Redeploy the project

### Red warning banner appears

**Cause**: Supabase not configured properly

**Fix:**
1. Click "Xem chi tiết" to see health check
2. Follow the troubleshooting steps
3. Check `/api/health` for detailed status

### Other issues

**Check browser console (F12) for detailed logs:**
- ✅ [Supabase] Environment variables loaded successfully
- ❌ [Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or invalid
- 🔐 [Auth] - Authentication flow
- 📱 [signin-phone API] - Phone lookup
- ✅/❌ - Success/Error indicators

## 📝 Notes

- **GEMINI_API_KEY** must be set as server-only env var in Vercel when deploying
- Use Node 18+ for Vercel
- Never commit `.env.local` (already in .gitignore)

## 🔒 Security

- Service Role Key is sensitive - only use server-side
- Anon Key can be public - used client-side
- If keys are leaked, rotate them immediately in Supabase Dashboard

## 📄 License

Private project
