# 🚨 Setup Instructions - Khắc phục lỗi đăng nhập

## Vấn đề phát hiện

File `.env.local` **CHƯA ĐƯỢC TẠO**, dẫn đến ứng dụng không thể kết nối với Supabase.

## ✅ Hướng dẫn khắc phục (5 phút)

### Bước 1: Tạo file `.env.local`

```bash
# Copy file mẫu
cp .env.local.example .env.local
```

### Bước 2: Lấy Supabase credentials

1. **Truy cập Supabase Dashboard:**
   - Đăng nhập vào https://supabase.com/dashboard
   - Chọn project của bạn

2. **Lấy Project URL và API Keys:**
   - Vào **Settings** → **API**
   - Copy các thông tin sau:
     * **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     * **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     * **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### Bước 3: Cập nhật file `.env.local`

Mở file `.env.local` và điền credentials:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Gemini AI API Key (optional - cho AI features)
GEMINI_API_KEY=your_gemini_api_key

# Zalo ZNS (optional - cho SMS OTP)
ZNS_ACCESS_TOKEN=your_zns_access_token
ZNS_TEMPLATE_ID=your_zns_template_id
```

### Bước 4: Cấu hình Redirect URLs trong Supabase

1. Vào **Authentication** → **URL Configuration**
2. Thêm các URLs sau vào **Redirect URLs**:

```
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```

### Bước 5: Kiểm tra Authentication settings

1. Vào **Authentication** → **Providers**
2. Bật các providers bạn muốn dùng:
   - ✅ **Email** (cho phone + password login)
   - ✅ **Google** (nếu dùng Google login)

3. Vào **Authentication** → **Settings**
4. Kiểm tra:
   - **Enable email confirmations**: Tùy chọn (có thể tắt cho dev)
   - **Disable email confirmations**: Bật nếu muốn test nhanh

### Bước 6: Tạo bảng profiles (nếu chưa có)

Chạy SQL sau trong **SQL Editor**:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  birthday DATE,
  gender TEXT,
  zalo_id TEXT,
  membership TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create index for phone number lookup
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number
  ON profiles(phone_number);

-- Auto-update updated_at
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

### Bước 7: Restart dev server

```bash
# Dừng server hiện tại (Ctrl+C)
# Khởi động lại
npm run dev
```

---

## 🚀 Hướng dẫn cho Vercel Production (Quan trọng!)

Nếu bạn đã deploy lên Vercel và gặp lỗi đăng nhập, làm theo hướng dẫn này:

### 1. Truy cập Vercel Dashboard

1. Đăng nhập vào https://vercel.com
2. Chọn project của bạn (ví dụ: `cpls`)

### 2. Cấu hình Environment Variables

1. Vào **Settings** → **Environment Variables**
2. Thêm các biến sau:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJI...` (JWT token) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJI...` (JWT token) | Production, Preview, Development |
| `GEMINI_API_KEY` | Your Gemini key (optional) | Production only |

**Quan trọng:**
- Đánh dấu tất cả 3 environments: Production, Preview, Development
- SUPABASE_SERVICE_ROLE_KEY rất nhạy cảm - chỉ dùng server-side

### 3. Redeploy sau khi cập nhật

**QUAN TRỌNG:** Vercel không tự động rebuild khi bạn thêm env vars!

```bash
# Option 1: Trigger redeploy từ Dashboard
Deployments → ⋯ (menu) → Redeploy

# Option 2: Từ Git
git commit --allow-empty -m "Trigger redeploy"
git push
```

### 4. Kiểm tra Environment Variables

Truy cập: `https://your-app.vercel.app/api/health`

**✅ Nếu thành công:**
```json
{
  "status": "healthy",
  "message": "All environment variables are configured correctly"
}
```

**❌ Nếu lỗi:**
```json
{
  "status": "unhealthy",
  "message": "Environment variables are missing or invalid",
  "troubleshooting": { ... }
}
```

### 5. Cập nhật Redirect URLs

Vào Supabase Dashboard → **Authentication** → **URL Configuration**

Thêm production URL vào Redirect URLs:
```
https://your-app.vercel.app/auth/callback
```

### 6. Debugging trên Vercel

Nếu vẫn lỗi:

1. **Check Runtime Logs:**
   - Vào Deployments → Chọn deployment
   - Click "View Function Logs"
   - Tìm dòng có `❌ [Supabase]`

2. **Check Browser Console:**
   - Mở https://your-app.vercel.app
   - F12 → Console
   - Nếu thấy "❌ [Supabase] NEXT_PUBLIC_SUPABASE_URL is missing"
   → Env vars chưa được load, cần redeploy

3. **Verify Build Logs:**
   - Vào Deployments → Build Logs
   - Kiểm tra có warning nào về env vars không

---

## 🧪 Test kết nối

Sau khi setup xong, test bằng cách:

1. Mở browser console (F12)
2. Truy cập http://localhost:3000/login
3. Kiểm tra console logs:

**✅ Nếu thành công:**
```
Supabase client initialized
No errors about missing env vars
```

**❌ Nếu vẫn lỗi:**
```
Missing NEXT_PUBLIC_SUPABASE_URL environment variable
Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable
```

## 📝 Checklist

- [ ] File `.env.local` đã tạo
- [ ] Đã điền `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Đã điền `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Đã điền `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Đã thêm redirect URLs trong Supabase
- [ ] Đã bật Email provider
- [ ] Đã tạo bảng profiles
- [ ] Đã restart dev server
- [ ] Đã test login

## ⚠️ Lưu ý quan trọng

1. **KHÔNG commit file `.env.local`** - đã có trong `.gitignore`
2. **Service Role Key** rất nhạy cảm - chỉ dùng server-side
3. **Anon Key** có thể public - được dùng client-side
4. Nếu leak keys, hãy **rotate keys** ngay trong Supabase dashboard

## 🆘 Vẫn gặp lỗi?

Kiểm tra logs chi tiết:

```bash
# Mở browser console khi đăng nhập
# Tìm các dòng có:
❌ [Auth] ...
❌ [signin-phone API] ...
❌ [Callback] ...
```

Các lỗi thường gặp:

| Lỗi | Nguyên nhân | Cách fix |
|------|-------------|----------|
| "Missing NEXT_PUBLIC_SUPABASE_URL" | Chưa setup .env.local | Làm theo bước 1-3 |
| "Số điện thoại không tồn tại" | User chưa đăng ký | Đăng ký tài khoản trước |
| "Server configuration error" | Thiếu SUPABASE_SERVICE_ROLE_KEY | Thêm vào .env.local |
| "Invalid login credentials" | Sai password | Kiểm tra lại password |
| "Xác thực hết thời gian chờ" | Supabase không phản hồi | Check network/credentials |

---

**Tạo bởi:** Claude Code
**Ngày:** 2025-12-03
**Mục đích:** Hướng dẫn setup Supabase để fix lỗi đăng nhập
