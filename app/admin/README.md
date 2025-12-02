# 🎛️ Admin Dashboard - Hướng dẫn sử dụng

## Tổng quan

Admin Dashboard là trang quản trị dành cho admin và moderator của webapp. Chỉ những người dùng có `role = 'admin'` hoặc `role = 'mod'` mới có thể truy cập.

### Tính năng chính:

1. **📊 Dashboard Analytics**
   - Thống kê tổng số người dùng
   - Số lượng Premium/Free users
   - Số người dùng hoạt động trong ngày
   - Tín hiệu giao dịch gần đây

2. **📈 Analytics Integration Widget**
   - Tích hợp Microsoft Clarity (session recordings, heatmaps)
   - Tích hợp Google Analytics (traffic, conversions)
   - Quản lý bật/tắt các analytics tools
   - Cấu hình Analytics IDs

---

## 🚀 Bắt đầu

### Bước 1: Chạy migration để thêm field `role`

```bash
# Kết nối Supabase và chạy migration
psql -h your-supabase-host -U postgres -d postgres < migrations/add_role_to_profiles.sql
```

Hoặc sử dụng Supabase Dashboard:
1. Vào **SQL Editor**
2. Copy nội dung file `migrations/add_role_to_profiles.sql`
3. Chạy query

### Bước 2: Set admin role cho tài khoản của bạn

```sql
-- Thay your-admin@example.com bằng email của bạn
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-admin@example.com';
```

### Bước 3: Truy cập Admin Dashboard

1. Login vào webapp
2. Vào sidebar, tìm **Admin Dashboard** (màu tím)
3. Click vào để truy cập `/admin`

---

## 📈 Cấu hình Analytics

### Microsoft Clarity (Đã được tích hợp sẵn)

**Clarity ID hiện tại:** `udywqzdpit`

Clarity đã được cấu hình sẵn với project ID `udywqzdpit`. Script sẽ tự động load trên tất cả các trang.

#### Xem dữ liệu Clarity:
1. Vào [https://clarity.microsoft.com](https://clarity.microsoft.com)
2. Login bằng Microsoft account
3. Tìm project với ID `udywqzdpit`
4. Xem:
   - **Heatmaps**: Click patterns, scroll depth
   - **Session recordings**: Xem người dùng sử dụng webapp như thế nào
   - **Insights**: Rage clicks, dead clicks, quick backs

#### Thay đổi Clarity Project ID:
1. Vào Admin Dashboard → Analytics Integration Widget
2. Click **✏️ Chỉnh sửa**
3. Nhập Clarity Project ID mới
4. Click **✅ Lưu**
5. Reload trang để áp dụng

### Google Analytics (Tùy chọn)

Nếu muốn thêm Google Analytics:

1. Tạo Google Analytics property:
   - Vào [https://analytics.google.com](https://analytics.google.com)
   - Tạo property mới hoặc dùng property có sẵn
   - Copy **Measurement ID** (format: `G-XXXXXXXXXX`)

2. Cấu hình trong Admin Dashboard:
   - Vào Admin Dashboard → Analytics Integration Widget
   - Click **✏️ Chỉnh sửa**
   - Bật toggle **Google Analytics**
   - Nhập **Measurement ID**
   - Click **✅ Lưu**
   - Reload trang để áp dụng

---

## 🔐 Phân quyền

### Roles:

| Role | Quyền truy cập | Mô tả |
|------|---------------|-------|
| `user` | Standard features | Người dùng thông thường |
| `mod` | Admin Dashboard + Management | Moderator |
| `admin` | Full access | Administrator (toàn quyền) |

### Cấp quyền admin/mod cho user:

```sql
-- Cấp quyền admin
UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';

-- Cấp quyền moderator
UPDATE profiles SET role = 'mod' WHERE email = 'user@example.com';

-- Thu hồi quyền (về user thông thường)
UPDATE profiles SET role = 'user' WHERE email = 'user@example.com';
```

---

## 📊 Analytics Data

### Dữ liệu được thu thập:

**Microsoft Clarity:**
- Session recordings (ghi hình user sử dụng webapp)
- Click events (clicks, rage clicks, dead clicks)
- Scroll depth (độ cuộn trang)
- Heatmaps (bản đồ nhiệt clicks/scrolls)
- User journey (hành trình người dùng)

**Google Analytics:**
- Pageviews (lượt xem trang)
- Session duration (thời gian session)
- Bounce rate (tỷ lệ thoát)
- User demographics (nhân khẩu học)
- Conversion tracking (theo dõi chuyển đổi)
- Custom events (sự kiện tùy chỉnh)

### Xem dữ liệu realtime:

- **Clarity**: Dữ liệu hiển thị sau ~10 phút
- **Google Analytics**: Dữ liệu hiển thị sau ~24 giờ (realtime: ngay lập tức)

---

## 🛠️ Troubleshooting

### Không thấy Admin Dashboard trong sidebar?

1. Kiểm tra role trong database:
   ```sql
   SELECT id, email, role FROM profiles WHERE email = 'your-email@example.com';
   ```

2. Đảm bảo role là `'admin'` hoặc `'mod'`

3. Logout và login lại

4. Clear browser cache

### Analytics không hoạt động?

1. Kiểm tra Admin Dashboard → Analytics Widget
2. Đảm bảo toggle đã được bật
3. Kiểm tra Analytics ID có đúng không
4. Reload trang sau khi save
5. Kiểm tra Console (F12) xem có lỗi không

### Script Clarity/GA bị blocked?

- Có thể do ad blocker hoặc privacy extensions
- Test ở incognito mode hoặc tắt extensions
- Kiểm tra Content Security Policy (CSP)

---

## 📚 Tài liệu tham khảo

- [Microsoft Clarity Documentation](https://docs.microsoft.com/en-us/clarity/)
- [Google Analytics Documentation](https://developers.google.com/analytics)
- [Next.js Script Component](https://nextjs.org/docs/app/api-reference/components/script)

---

## 🔒 Bảo mật

**Lưu ý quan trọng:**
- Chỉ cấp quyền admin/mod cho người đáng tin cậy
- Analytics IDs được lưu trong localStorage (client-side)
- Không lưu thông tin nhạy cảm trong analytics events
- Tuân thủ GDPR/privacy laws khi thu thập dữ liệu người dùng
- Thông báo cho người dùng về việc sử dụng analytics (Privacy Policy)

---

## 📞 Hỗ trợ

Nếu có vấn đề khi sử dụng Admin Dashboard, vui lòng:
1. Kiểm tra logs trong browser Console (F12)
2. Kiểm tra database Supabase
3. Liên hệ tech team để được hỗ trợ

---

**Version:** 1.0
**Last Updated:** 2025-12-02
