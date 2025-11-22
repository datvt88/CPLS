# Device Tracking & Session Management Setup

## Tổng quan

Hệ thống quản lý session và thiết bị giúp:
- ✅ Giữ cookie đăng nhập lâu dài (không bị logout khi đóng trình duyệt)
- ✅ Giới hạn tối đa 3 thiết bị đăng nhập cùng lúc
- ✅ Tự động đăng xuất thiết bị cũ nhất khi đăng nhập thiết bị thứ 4
- ✅ Quản lý và xem danh sách thiết bị đang đăng nhập
- ✅ Đăng xuất từ xa các thiết bị khác

## Setup Instructions

### Bước 1: Chạy Database Migration

Truy cập Supabase SQL Editor:
```
https://app.supabase.com/project/[YOUR_PROJECT_ID]/sql
```

Copy và chạy nội dung file:
```
supabase/migrations/20250122_create_user_devices.sql
```

Hoặc chạy từng câu lệnh:

```sql
-- Create user_devices table
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_address INET,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_active ON public.user_devices(last_active_at);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own devices"
  ON public.user_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON public.user_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON public.user_devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON public.user_devices FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.user_devices TO authenticated;
```

### Bước 2: Cấu hình Supabase Auth Settings (Optional)

Truy cập: `Authentication` → `Settings`

Điều chỉnh các settings sau:

**JWT Expiry:**
- `JWT expiry limit`: 604800 (7 ngày)
- `Refresh token expiry`: 2592000 (30 ngày)

**Security:**
- ✅ Enable email confirmations (optional)
- ✅ Enable phone confirmations (optional)

### Bước 3: Thêm ActiveDevices Component vào Profile Page

Update `/app/profile/page.tsx`:

```tsx
import ActiveDevices from '@/components/ActiveDevices'

// ... trong component
<ActiveDevices />
```

### Bước 4: Test

1. **Test đăng nhập:**
   - Đăng nhập trên browser 1
   - Đóng browser và mở lại → Vẫn đăng nhập

2. **Test giới hạn 3 thiết bị:**
   - Đăng nhập trên Chrome
   - Đăng nhập trên Firefox
   - Đăng nhập trên Edge
   - Đăng nhập trên Safari → Chrome sẽ tự động logout

3. **Test quản lý thiết bị:**
   - Vào Profile → Xem danh sách thiết bị
   - Click "Đăng xuất" trên thiết bị khác

## Cách hoạt động

### Device Fingerprinting

Mỗi thiết bị được nhận dạng qua:
- User Agent
- Screen resolution
- Timezone
- Hardware info
- Combination hash

### Session Management

1. **Khi login:**
   - Tạo device ID và lưu vào localStorage
   - Check số lượng devices hiện tại
   - Nếu ≥ 3 devices → Xóa device cũ nhất
   - Register device mới vào database

2. **Khi active:**
   - Update `last_active_at` mỗi lần user thao tác
   - Session tự động refresh qua Supabase

3. **Khi logout:**
   - Xóa device khỏi database
   - Clear localStorage
   - Revoke Supabase session

### Auto Cleanup

- Devices không hoạt động > 30 ngày sẽ tự động bị xóa
- Chạy function `cleanup_inactive_devices()` định kỳ (manual hoặc cron job)

## API Usage

### Track Device (Auto call on login)
```typescript
await authService.trackUserDevice(userId)
```

### Get User Devices
```typescript
const { devices } = await authService.getUserDevices()
```

### Remove Device
```typescript
await authService.removeUserDevice(deviceId)
```

### Update Activity
```typescript
await authService.updateDeviceActivity()
```

## Security Notes

1. **Device ID không phải là security token**
   - Chỉ dùng để nhận dạng thiết bị
   - Không thể dùng để bypass authentication

2. **Session vẫn được bảo vệ bởi Supabase JWT**
   - JWT token được refresh tự động
   - Chỉ valid trong thời gian cấu hình

3. **RLS Protection**
   - User chỉ xem/quản lý được device của mình
   - Không thể xem device của user khác

## Troubleshooting

### Không giữ đăng nhập sau khi đóng browser

- Check localStorage có `cpls-auth-token` không
- Check Supabase session config
- Clear cache và thử lại

### Device limit không hoạt động

- Check migration đã chạy thành công chưa
- Check RLS policies
- Xem console logs

### Device không tự động cleanup

- Chạy manual: `SELECT cleanup_inactive_devices()`
- Setup cron job cho auto cleanup

## Migration Rollback

Nếu cần rollback:

```sql
DROP TABLE IF EXISTS public.user_devices CASCADE;
DROP FUNCTION IF EXISTS cleanup_inactive_devices();
```

## Future Enhancements

- [ ] IP-based geolocation
- [ ] Email notification khi có device mới
- [ ] Two-factor authentication
- [ ] Suspicious login detection
- [ ] Device trust/remember feature
