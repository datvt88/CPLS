# 🚀 START HERE - Complete Database Setup

## ❌ Lỗi bạn vừa gặp

```
ERROR: 42P01: relation "profiles" does not exist
```

**Nguyên nhân:** Bảng `profiles` chưa được tạo trong database.

---

## ✅ Giải pháp - Chạy script đầy đủ

Tôi đã tạo **1 script duy nhất** để setup toàn bộ database từ đầu.

---

## 📋 Các bước thực hiện

### **Bước 1: Mở file SQL**

```
COMPLETE_DATABASE_SETUP.sql
```

### **Bước 2: Copy toàn bộ nội dung**

- **Select All**: `Ctrl/Cmd + A`
- **Copy**: `Ctrl/Cmd + C`

### **Bước 3: Vào Supabase SQL Editor**

1. Truy cập: https://app.supabase.com/
2. Chọn project của bạn
3. Click **SQL Editor** (sidebar trái)
4. Click **New query**

### **Bước 4: Paste và Run**

1. **Paste**: `Ctrl/Cmd + V`
2. **Run**: `Ctrl/Cmd + Enter` hoặc click nút **RUN**

### **Bước 5: Kiểm tra kết quả**

Bạn sẽ thấy nhiều bảng kết quả:

#### ✅ Table Status
| item | status |
|------|--------|
| profiles table | ✅ Created |

#### ✅ Columns Created
| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| email | text | NO | - |
| id | uuid | NO | - |
| membership | text | NO | 'free'::text |
| phone_number | text | YES | NULL |
| provider | text | NO | 'email'::text |
| provider_id | text | YES | NULL |

#### ✅ Indexes Created
| indexname | tablename |
|-----------|-----------|
| idx_profiles_nickname | profiles |
| idx_profiles_phone_number | profiles |
| idx_profiles_provider | profiles |
| idx_profiles_provider_id | profiles |
| idx_profiles_zalo_id | profiles |
| profiles_email_key | profiles |
| profiles_pkey | profiles |
| profiles_zalo_id_key | profiles |

#### ✅ Triggers Created
| trigger_name | event_manipulation | action_timing |
|--------------|-------------------|---------------|
| on_auth_user_created | INSERT | AFTER |
| on_auth_user_created | UPDATE | AFTER |
| update_profiles_updated_at | UPDATE | BEFORE |

#### ✅ Functions Created
| function_name | status |
|---------------|--------|
| handle_new_user | Created |
| update_updated_at_column | Created |

---

## 🎯 Script này làm gì?

### **STEP 1: Tạo bảng profiles**
- Tất cả các trường cần thiết
- Hỗ trợ Google OAuth từ đầu
- phone_number nullable (optional)

### **STEP 2: Tạo indexes**
- Tăng tốc queries
- Index cho email, phone, provider

### **STEP 3: Auto-update timestamp**
- Tự động cập nhật `updated_at`

### **STEP 4: Auto-sync profile function**
- Tự động tạo profile khi user đăng nhập
- Lấy data từ Google OAuth
- Update nếu user đã tồn tại

### **STEP 5: Triggers**
- Chạy function tự động
- Kích hoạt khi user login

### **STEP 6: Documentation**
- Comments cho từng column

### **STEP 7: Bảng signals**
- Tạo bảng signals nếu cần

---

## ✅ Sau khi setup thành công

### **1. Enable Google Provider**

1. Supabase Dashboard > **Authentication** > **Providers**
2. Tìm **Google**
3. Toggle **ON**
4. Nhập:
   - **Client ID**: Từ Google Cloud Console
   - **Client Secret**: Từ Google Cloud Console
5. Click **Save**

### **2. Test đăng nhập Google**

```bash
# Chạy app
npm run dev

# Mở browser
http://localhost:3000

# Click "Đăng nhập bằng Google"
```

### **3. Kiểm tra profile tự động**

Sau khi đăng nhập, vào Supabase Dashboard:
1. **Table Editor** > **profiles**
2. Sẽ thấy record mới với:
   - ✅ email từ Google
   - ✅ full_name từ Google
   - ✅ avatar_url từ Google
   - ✅ provider = 'google'
   - ✅ membership = 'free'

---

## 🔧 Troubleshooting

### Lỗi: "permission denied"

**Giải pháp:** Bạn cần quyền admin. Chạy script trong Supabase Dashboard (không phải local).

### Script chạy nhưng không thấy verification results

**Giải pháp:** Scroll xuống dưới cùng của SQL Editor, sẽ thấy nhiều tabs với kết quả.

### Vẫn báo lỗi "relation does not exist"

**Kiểm tra:**
1. Script đã chạy thành công chưa?
2. Có thấy "Success" không?
3. Có thấy verification tables không?

**Nếu vẫn lỗi:**
Chạy query này để check:
```sql
SELECT * FROM information_schema.tables
WHERE table_name = 'profiles';
```

Nếu không có kết quả → Script chưa chạy thành công.

---

## 📚 Tài liệu liên quan

| File | Mục đích |
|------|----------|
| **COMPLETE_DATABASE_SETUP.sql** | ⭐ SCRIPT CHÍNH - Chạy file này |
| START_HERE_DATABASE_SETUP.md | 📖 File này - Hướng dẫn |
| HOW_TO_RUN_MIGRATION.md | Hướng dẫn migration (không cần nữa) |
| SUPABASE_GOOGLE_SETUP_QUICKSTART.md | Setup Google OAuth |
| docs/GOOGLE_AUTH_SETUP.md | Chi tiết Google setup |

---

## ✅ Checklist

Setup database:
- [ ] Mở file `COMPLETE_DATABASE_SETUP.sql`
- [ ] Copy toàn bộ (Ctrl/Cmd + A)
- [ ] Vào Supabase SQL Editor
- [ ] Paste và Run
- [ ] Thấy "Success" và verification tables
- [ ] ✅ Database ready!

Setup Google OAuth:
- [ ] Google Cloud Console → Tạo OAuth Client
- [ ] Copy Client ID và Secret
- [ ] Supabase → Enable Google Provider
- [ ] Paste credentials
- [ ] Save
- [ ] ✅ Google OAuth ready!

Test:
- [ ] npm run dev
- [ ] Click "Đăng nhập bằng Google"
- [ ] Đăng nhập thành công
- [ ] Check profile trong Table Editor
- [ ] ✅ Everything works!

---

## 🎉 Kết luận

Sau khi chạy script này:
1. ✅ Bảng `profiles` đã được tạo
2. ✅ Tất cả indexes đã sẵn sàng
3. ✅ Auto-sync profile đã hoạt động
4. ✅ Sẵn sàng cho Google OAuth

**Không cần chạy migration khác nữa!**

---

**Script Version:** 1.0 - Complete Setup
**Status:** ✅ Production Ready
**Date:** 2025-01-20
