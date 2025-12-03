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
- **Session**: 8-hour JWT with auto-refresh

## ⏱️ Session Management (8 Hours)

The app is configured to keep users logged in for **8 hours** without requiring re-login.

### Key Features:
- ✅ **8-hour session duration** (configurable in Supabase)
- ✅ **Auto-refresh tokens** 5 minutes before expiry
- ✅ **Persistent sessions** across browser restarts
- ✅ **30-day refresh token** lifetime
- ✅ **Activity monitoring** and tab visibility handling

### Setup 8-Hour Sessions:

1. **Configure Supabase Dashboard:**
   - Go to Settings → Authentication
   - Set **JWT Expiry** to `28800` seconds (8 hours)
   - Save changes

2. **Verify in Console:**
   ```javascript
   // Run in browser console after login
   getSessionInfo()
   ```

   Expected output:
   ```
   ✓ Session expires in: ~8 hours
   ✓ Auto-refresh: Enabled
   ```

3. **Session Lifecycle:**
   - **0h**: Login, session valid for 8 hours
   - **7h 55m**: Auto-refresh triggered
   - **8h**: New session valid for another 8 hours
   - **30 days**: Refresh token expires, re-login required

📖 **Detailed guide**: [docs/SESSION_8H_CONFIG.md](./docs/SESSION_8H_CONFIG.md)

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
