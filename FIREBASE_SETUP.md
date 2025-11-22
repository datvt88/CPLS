# Firebase Configuration for Chat Room

## Firebase Realtime Database Rules

Để chat room hoạt động, bạn cần cấu hình Firebase Realtime Database Rules như sau:

### Bước 1: Truy cập Firebase Console
1. Mở https://console.firebase.google.com
2. Chọn project: `wp-realtime-chat-cpls`
3. Vào **Realtime Database** → **Rules**

### Bước 2: Cập nhật Rules

Paste đoạn code sau vào Rules:

```json
{
  "rules": {
    "messages": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$messageId": {
        ".validate": "newData.hasChildren(['text', 'userId', 'username', 'timestamp'])",
        "text": {
          ".validate": "newData.isString() && newData.val().length <= 1000"
        },
        "userId": {
          ".validate": "newData.isString()"
        },
        "username": {
          ".validate": "newData.isString()"
        },
        "timestamp": {
          ".validate": "newData.isNumber()"
        },
        "imageUrl": {
          ".validate": "newData.isString()"
        },
        "avatar": {
          ".validate": "newData.isString()"
        },
        "reactions": {
          ".read": true,
          ".write": "auth != null"
        },
        "readBy": {
          ".read": true,
          ".write": "auth != null"
        },
        "replyTo": {
          ".validate": "newData.hasChildren(['messageId', 'text', 'username'])"
        }
      }
    }
  }
}
```

### Bước 3: Cấu hình Firebase Storage Rules

Vào **Storage** → **Rules** và paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /chat-images/{userId}/{imageId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### Bước 4: Publish Rules

Click **Publish** để áp dụng rules.

## Troubleshooting

### Lỗi "Đang kiểm tra quyền truy cập..."

Nếu gặp lỗi này:

1. **Kiểm tra đăng nhập**: Đảm bảo user đã đăng nhập
   - Nếu chưa, trang sẽ tự redirect về `/login` sau 5 giây

2. **Clear cache và refresh**:
   ```bash
   # Trên browser
   Ctrl + Shift + R (Windows/Linux)
   Cmd + Shift + R (Mac)
   ```

3. **Restart dev server**:
   ```bash
   # Stop server (Ctrl+C)
   # Then restart
   npm run dev
   ```

4. **Kiểm tra console log**: Mở DevTools (F12) → Console để xem error

### Lỗi Firebase Permission Denied

Nếu thấy lỗi "Permission denied" trong console:
- Kiểm tra Firebase Rules đã được cấu hình đúng chưa
- Đảm bảo user đã authenticated với Supabase

### Lỗi khi upload ảnh

Nếu không upload được ảnh:
- Kiểm tra Firebase Storage Rules
- Kiểm tra kích thước ảnh (max 5MB)
- Kiểm tra định dạng file (chỉ cho phép image/*)

## Authentication Flow

1. User login qua Supabase
2. Supabase tạo session
3. ProtectedRoute check session
4. Nếu có session → grant access
5. ChatRoom component load và connect Firebase
6. Messages realtime sync

## Notes

- Firebase authentication không sử dụng - chỉ dùng cho storage/database
- Supabase xử lý authentication chính
- Read status được track theo userId từ Supabase
