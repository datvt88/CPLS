# Zalo Graph API v2.0 - Available User Fields

## Tổng quan

Tài liệu này mô tả chính xác các trường dữ liệu người dùng có sẵn từ Zalo Graph API v2.0 endpoint `/me`.

## Các trường có sẵn

Zalo Graph API v2.0 cung cấp các trường sau thông qua endpoint `https://graph.zalo.me/v2.0/me`:

### 1. **id** (string)
- Zalo User ID duy nhất
- Bắt buộc
- Ví dụ: `"1234567890123456789"`

### 2. **name** (string)
- Tên đầy đủ của người dùng
- Ví dụ: `"Nguyễn Văn A"`

### 3. **birthday** (string)
- Ngày sinh của người dùng
- Format: `DD/MM/YYYY`
- Ví dụ: `"15/08/1990"`
- Có thể null nếu người dùng không cung cấp

### 4. **gender** (string)
- Giới tính
- Giá trị: `"male"` hoặc `"female"`
- Có thể null nếu người dùng không cung cấp

### 5. **picture** (object)
- Ảnh đại diện của người dùng
- Cấu trúc: `{ data: { url: string } }`
- Ví dụ:
  ```json
  {
    "data": {
      "url": "https://s120-ava-talk.zadn.vn/..."
    }
  }
  ```

## Trường KHÔNG có sẵn

### ❌ phone_number
**QUAN TRỌNG**: Zalo Graph API v2.0 **KHÔNG** cung cấp số điện thoại qua endpoint `/me`.

Nếu cần số điện thoại:
- Yêu cầu người dùng nhập thủ công trong profile settings
- Hoặc sử dụng số placeholder và cho phép cập nhật sau

## Cách request

### Request Header
```http
GET https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture
access_token: <ACCESS_TOKEN>
Content-Type: application/json
```

### Response Success
```json
{
  "id": "1234567890123456789",
  "name": "Nguyễn Văn A",
  "birthday": "15/08/1990",
  "gender": "male",
  "picture": {
    "data": {
      "url": "https://s120-ava-talk.zadn.vn/..."
    }
  }
}
```

### Response Error
```json
{
  "error": {
    "message": "Invalid access token",
    "code": 124
  }
}
```

## Implementation trong CPLS

### 1. API Route (`/api/auth/zalo/user/route.ts`)
```typescript
const userResponse = await fetch(
  `https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture`,
  {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'access_token': access_token,
    },
  }
)
```

### 2. Database Schema
```sql
CREATE TABLE profiles (
  -- ... other fields ...
  zalo_id TEXT UNIQUE,
  birthday TEXT,  -- DD/MM/YYYY
  gender TEXT CHECK (gender IN ('male', 'female')),
  -- ... other fields ...
);
```

### 3. TypeScript Interface
```typescript
interface ZaloUser {
  id: string
  name: string
  birthday?: string  // DD/MM/YYYY
  gender?: 'male' | 'female'
  picture?: string   // URL extracted from picture.data.url
}
```

### 4. Callback Handler
```typescript
// Save all available fields from Zalo
await profileService.upsertProfile({
  id: session.user.id,
  email: pseudoEmail,
  phone_number: '0000000000',  // Placeholder - NOT from Zalo
  full_name: zaloUser.name,
  avatar_url: zaloUser.picture,
  birthday: zaloUser.birthday,
  gender: zaloUser.gender,
  zalo_id: zaloUser.id,
  membership: 'free',
})
```

## Best Practices

### ✅ DO
- Request tất cả các trường có sẵn: `id,name,birthday,gender,picture`
- Kiểm tra null/undefined cho birthday và gender
- Lưu birthday dưới dạng string với format DD/MM/YYYY
- Extract picture URL từ `picture.data.url`
- Sử dụng placeholder cho phone_number

### ❌ DON'T
- Đừng giả định Zalo cung cấp phone_number
- Đừng bắt buộc birthday và gender (chúng có thể null)
- Đừng thử convert format của birthday (giữ nguyên DD/MM/YYYY)
- Đừng request các trường không tồn tại

## Tài liệu tham khảo

- [Zalo Developers - Social API](https://developers.zalo.me/docs/api/social-api-4)
- [User Access Token V4](https://developers.zalo.me/docs/social-api/tham-khao/user-access-token-v4)
- [Zalo PHP SDK Reference](https://github.com/zaloplatform/zalo-php-sdk)

## Changelog

### 2025-01-16
- ✅ Fixed: Thêm birthday và gender vào request
- ✅ Fixed: Xóa giả định về phone_number
- ✅ Fixed: Cập nhật schema và types
- ✅ Fixed: Cập nhật callback handler để lưu đầy đủ thông tin

### Previous
- ❌ Issue: Chỉ request id, name, picture
- ❌ Issue: Callback cố gắng đọc zaloUser.phone (không tồn tại)
- ❌ Issue: Thiếu birthday và gender trong database
