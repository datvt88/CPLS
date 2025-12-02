# Vercel Environment Variables

Để deploy project lên Vercel, bạn cần thiết lập các environment variables sau:

## Required Environment Variables

### Supabase
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Google Gemini AI
```
GEMINI_API_KEY=your-gemini-api-key
```

### Zalo Notification Service (Optional)
```
ZNS_ACCESS_TOKEN=your-zns-access-token
ZNS_TEMPLATE_ID=your-template-id
```

### Zalo OAuth (Deprecated but supported)
```
NEXT_PUBLIC_ZALO_APP_ID=your-zalo-app-id
ZALO_APP_SECRET=your-zalo-app-secret
```

## Cách thiết lập trên Vercel

1. Vào project trên Vercel Dashboard
2. Settings → Environment Variables
3. Thêm từng biến với giá trị tương ứng
4. Chọn environment: Production, Preview, Development (hoặc cả 3)
5. Click "Save"
6. Redeploy project để áp dụng

## Lưu ý quan trọng

⚠️ **SUPABASE_SERVICE_ROLE_KEY** là bắt buộc cho:
- Admin user creation API (`/api/admin/create-user`)
- Server-side operations với full permissions

⚠️ **GEMINI_API_KEY** là bắt buộc cho:
- AI stock analysis features
- Stock recommendations

## Local Development

Tạo file `.env.local` với nội dung:
```bash
# Copy from .env.local.example
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
# ... other env vars
```

**Không commit file `.env.local` vào git!** (đã có trong `.gitignore`)

## Kiểm tra env variables

Sau khi thiết lập, kiểm tra bằng cách:
1. Build locally: `npm run build`
2. Start production: `npm start`
3. Test các tính năng cần env variables

Nếu thiếu env variables, sẽ có lỗi:
- `Error: Missing Supabase environment variables`
- `Error: supabaseKey is required`
