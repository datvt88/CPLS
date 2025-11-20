# Hướng dẫn cài đặt trang Quản lý Admin

## 📋 Tổng quan

Hệ thống quản lý admin cho phép quản trị viên và moderator quản lý người dùng, bao gồm:
- Xem danh sách users với pagination
- Tìm kiếm và lọc users theo role, membership
- Chỉnh sửa thông tin user
- Thay đổi quyền (role): user, mod, admin
- Thay đổi gói đăng ký (membership): free, premium
- Thiết lập ngày hết hạn Premium

## 🗄️ Bước 1: Chạy Migration Database

### 1.1. Truy cập Supabase Dashboard
- Mở [Supabase Dashboard](https://app.supabase.com)
- Chọn project của bạn
- Vào **SQL Editor** (biểu tượng ⚡ trong sidebar)

### 1.2. Chạy Migration Script
- Click "New query"
- Copy toàn bộ nội dung file `migrations/006_add_admin_role_system.sql`
- Paste vào SQL Editor
- Click **RUN** hoặc nhấn **Ctrl+Enter**

### 1.3. Kiểm tra Migration thành công
Chạy query sau để verify:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';
```

Kết quả mong đợi:
```
column_name | data_type | column_default
------------|-----------|---------------
role        | text      | 'user'::text
```

## 👤 Bước 2: Tạo Admin User Đầu Tiên

### 2.1. Lấy User ID của bạn
Đăng nhập vào webapp và vào trang Profile, copy User ID từ console hoặc:

```sql
SELECT id, email, full_name, role
FROM profiles
WHERE email = 'your-email@example.com';
```

### 2.2. Nâng cấp lên Admin
Thay thế `YOUR_USER_ID` bằng ID thực tế:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = 'YOUR_USER_ID';
```

Hoặc nếu muốn nâng lên Moderator:

```sql
UPDATE profiles
SET role = 'mod'
WHERE id = 'YOUR_USER_ID';
```

### 2.3. Verify
```sql
SELECT id, email, full_name, role
FROM profiles
WHERE role IN ('admin', 'mod');
```

## 🎨 Bước 3: Truy cập trang Quản lý

1. **Đăng xuất và đăng nhập lại** để refresh session
2. Vào sidebar, bạn sẽ thấy menu **"🛡️ Quản lý"** (chỉ admin/mod mới thấy)
3. Click vào menu để truy cập `/management`

## 📊 Tính năng của trang Quản lý

### Statistics Dashboard
- **Tổng Users**: Tổng số người dùng đã đăng ký
- **Premium Users**: Số users có gói Premium
- **Free Users**: Số users có gói Free
- **Admins**: Số admin
- **Moderators**: Số moderator

### User Management
- **Tìm kiếm**: Tìm theo email, tên, nickname
- **Lọc theo quyền**: user, mod, admin
- **Lọc theo gói**: free, premium
- **Pagination**: 20 users/trang

### Edit User
Click "Chỉnh sửa" để:
- Cập nhật thông tin cá nhân (tên, nickname, email, SĐT)
- Thay đổi **Quyền**:
  - `user`: Người dùng thường
  - `mod`: Moderator (có quyền quản lý)
  - `admin`: Admin (full quyền)
- Thay đổi **Gói đăng ký**:
  - `free`: Gói miễn phí
  - `premium`: Gói Premium (có thể set ngày hết hạn)
- **Ngày hết hạn Premium**: Để trống = vĩnh viễn

## 🔒 Phân quyền

### User (mặc định)
- Truy cập các trang thông thường
- Không thể truy cập `/management`

### Moderator
- Tất cả quyền của User
- Truy cập trang `/management`
- Quản lý users (chỉnh sửa thông tin, membership)
- **Không nên** tự nâng role lên admin

### Admin
- Tất cả quyền của Moderator
- Full access trang `/management`
- Quản lý roles (bao gồm admin/mod)
- Quản lý toàn bộ hệ thống

## 🚨 Lưu ý quan trọng

### 1. Bảo mật
- **KHÔNG** chia sẻ quyền admin với người không tin tưởng
- **LUÔN** giữ ít nhất 1 admin account an toàn
- Cẩn thận khi thay đổi role của chính mình

### 2. Production Setup
Để production, chạy migration trên Supabase production project:
1. Vào Supabase project production
2. Chạy `migrations/006_add_admin_role_system.sql`
3. Manually set admin cho account của bạn

### 3. RLS Policies
Migration đã tạo RLS policy:
- Users có thể update profile của chính mình
- Admin/Mod có thể update profile của bất kỳ user nào
- Chỉ admin/mod mới có thể thay đổi role

## 📝 Queries hữu ích

### Xem tất cả admins/mods
```sql
SELECT id, email, full_name, role, created_at
FROM profiles
WHERE role IN ('admin', 'mod')
ORDER BY created_at DESC;
```

### Xem Premium users
```sql
SELECT id, email, full_name, membership, membership_expires_at
FROM profiles
WHERE membership = 'premium'
ORDER BY created_at DESC;
```

### Reset role về user
```sql
UPDATE profiles
SET role = 'user'
WHERE email = 'user-email@example.com';
```

### Set Premium vĩnh viễn
```sql
UPDATE profiles
SET membership = 'premium',
    membership_expires_at = NULL
WHERE email = 'user-email@example.com';
```

### Set Premium có hạn
```sql
UPDATE profiles
SET membership = 'premium',
    membership_expires_at = '2025-12-31'
WHERE email = 'user-email@example.com';
```

## 🎯 Next Steps (Tính năng đề xuất)

### 1. Activity Logs
- Log mọi thay đổi admin thực hiện
- Timestamp + admin_id + action + target_user_id

### 2. Bulk Actions
- Bulk update membership
- Bulk send notifications
- Export users to CSV

### 3. User Ban/Suspend
- Thêm field `status`: active, suspended, banned
- Ngăn user login khi bị ban

### 4. Email Notifications
- Gửi email khi membership thay đổi
- Gửi email khi được nâng quyền

### 5. Advanced Filters
- Filter theo ngày đăng ký
- Filter theo provider (google, zalo, email)
- Filter theo tình trạng Premium (active, expired)

### 6. User Analytics
- Biểu đồ users mới theo ngày/tháng
- Conversion rate (free → premium)
- Retention metrics

### 7. Payment Integration
- Tích hợp cổng thanh toán
- Auto-update membership khi thanh toán
- Invoice management

## 💡 Tips

1. **Backup trước khi thay đổi bulk**: Luôn backup database trước khi thay đổi nhiều users
2. **Test trên staging**: Test mọi thay đổi role/membership trên staging trước
3. **Document changes**: Ghi chú lại lý do khi thay đổi role/membership quan trọng
4. **Regular audits**: Định kỳ review danh sách admin/mod

## 🆘 Troubleshooting

### Không thấy menu "Quản lý" trong sidebar
- Kiểm tra role trong database: `SELECT role FROM profiles WHERE id = 'YOUR_ID'`
- Đăng xuất và đăng nhập lại
- Clear browser cache

### Bị redirect khi vào /management
- Bạn không phải admin/mod
- Profile chưa được tạo (user mới đăng ký qua Google OAuth)

### Không update được user
- Kiểm tra RLS policies đã được tạo chưa
- Kiểm tra admin có quyền update chưa
- Check console logs để xem lỗi cụ thể

### Migration fail
- Kiểm tra profiles table đã tồn tại chưa
- Chạy lại migration từ đầu
- Check syntax SQL (không copy markdown code fences)

## 📞 Support

Nếu gặp vấn đề, check:
1. Console logs trong browser (F12)
2. Supabase logs trong Dashboard
3. Network tab để xem API calls

---

**Chúc quản lý users hiệu quả! 🚀**
