CPLS - Trading dashboard (Next.js 15 + Supabase + Gemini + RBAC)

Setup:
1. Copy .env.local.example -> .env.local and fill SUPABASE + GEMINI keys.
2. Run SQL in schema.sql in Supabase SQL editor to create tables.
3. npm install
4. npm run dev

Notes:
- GEMINI_API_KEY must be set as server-only env var in Vercel when deploying.
- Use Node 18+ for Vercel.
