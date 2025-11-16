# 🔍 Zalo OAuth Debug Guide

## Lỗi: "Đăng nhập thất bại - Failed to get user info"

### Các nguyên nhân có thể:

#### 1. ❌ Access token không hợp lệ
**Dấu hiệu**: Server log hiện "Zalo API error: Invalid access token"

**Fix**:
- Check `NEXT_PUBLIC_ZALO_APP_ID` và `ZALO_APP_SECRET` đúng chưa
- Verify callback URL trên Zalo Developer Console

#### 2. ❌ Callback URL sai
**Dấu hiệu**: Không nhận được authorization code

**Fix**:
- Callback URL phải là: `https://beta.cophieuluotsong.com/auth/callback`
- KHÔNG phải: `https://beta.cophieuluotsong.com/?zalo-callback=true`

#### 3. ❌ CORS hoặc Network issues
**Dấu hiệu**: Browser console hiện "CORS error" hoặc "Network error"

**Fix**:
- Check internet connection
- Try clearing browser cache
- Try incognito mode

#### 4. ❌ Token exchange thất bại
**Dấu hiệu**: `/api/auth/zalo/token` trả về error

**Fix**:
- Check `code_verifier` đang được lưu trong sessionStorage
- Check PKCE flow đúng không

#### 5. ❌ User info API thất bại
**Dấu hiệu**: `/api/auth/zalo/user` trả về error

**Fix**:
- Access token có thể đã hết hạn
- Fields requested không đúng

---

## 📋 Debug Checklist

### Server-side (Vercel/Local Logs):

Tìm các dòng log sau:

```
✅ GOOD:
Zalo token response: {"access_token":"...","expires_in":3600}
Zalo user API response status: 200
Zalo user API response: {"id":"123...","name":"..."}
```

```
❌ BAD:
Zalo token exchange failed. Status: 400
Response: {"error":"invalid_request","error_description":"..."}
```

```
❌ BAD:
Zalo API error: {"error":{"message":"Invalid access token","code":124}}
```

### Client-side (Browser Console):

```
✅ GOOD:
Zalo user data received: {id: "123", name: "Nguyễn Văn A", ...}
Attempting to sign in with email: zalo_123@cpls.app
Session created for user: abc-def-...
```

```
❌ BAD:
Failed to get user info from Zalo
Auth callback error: Failed to create user: ...
```

### Network Tab:

**Request 1: POST /api/auth/zalo/token**
```
Request Body:
{
  "code": "ABC123...",
  "code_verifier": "xyz789..."
}

✅ Good Response (200):
{
  "access_token": "...",
  "expires_in": 3600
}

❌ Bad Response (400):
{
  "error": "Failed to exchange authorization code",
  "details": "..."
}
```

**Request 2: POST /api/auth/zalo/user**
```
Request Body:
{
  "access_token": "..."
}

✅ Good Response (200):
{
  "id": "1234567890",
  "name": "Nguyễn Văn A",
  "birthday": "15/08/1990",
  "gender": "male",
  "picture": "https://..."
}

❌ Bad Response (400):
{
  "error": "Failed to fetch user information",
  "details": "..."
}
```

---

## 🛠️ Common Fixes

### Fix 1: Check Environment Variables

```bash
# Verify trong .env.local
NEXT_PUBLIC_ZALO_APP_ID=your_app_id
ZALO_APP_SECRET=your_app_secret
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Test**:
```bash
# In terminal
echo $NEXT_PUBLIC_ZALO_APP_ID
echo $ZALO_APP_SECRET
```

### Fix 2: Verify Callback URL

**Zalo Developer Console**:
1. Go to https://developers.zalo.me/
2. Select your app
3. OAuth Settings
4. Redirect URIs must include:
   ```
   https://beta.cophieuluotsong.com/auth/callback
   ```

**Code**:
```typescript
// In components/ZaloLoginButton.tsx
const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI ||
                    `${window.location.origin}/auth/callback`

console.log('Redirect URI:', redirectUri)
// Should log: https://beta.cophieuluotsong.com/auth/callback
```

### Fix 3: Check Access Token Format

**Server logs should show**:
```
Zalo user API response status: 200
Zalo user API response: {"id":"...","name":"..."}
```

**If you see**:
```
Zalo user API response status: 400
Zalo user API response: {"error":{"message":"Invalid access token"}}
```

**Then**:
- Access token đã expired (>1 hour)
- Access token format sai
- API request sai

### Fix 4: Test API Manually

**Test token exchange**:
```bash
curl -X POST https://beta.cophieuluotsong.com/api/auth/zalo/token \
  -H "Content-Type: application/json" \
  -d '{
    "code": "YOUR_CODE_FROM_CALLBACK",
    "code_verifier": "YOUR_CODE_VERIFIER"
  }'
```

**Test user info**:
```bash
curl -X POST https://beta.cophieuluotsong.com/api/auth/zalo/user \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "YOUR_ACCESS_TOKEN"
  }'
```

---

## 📊 Debug Flow Diagram

```
User clicks "Đăng nhập Zalo"
  ↓
Redirect to Zalo OAuth
  ↓
User authorizes
  ↓
Redirect to /auth/callback?code=XXX&state=YYY
  ↓
POST /api/auth/zalo/token
  {code, code_verifier}
  ↓
  ✅ Success: {access_token, expires_in}
  ❌ Fail: Check logs for error
  ↓
POST /api/auth/zalo/user
  {access_token}
  ↓
  ✅ Success: {id, name, birthday, gender, picture}
  ❌ Fail: Check logs for error ← BẠN ĐANG Ở ĐÂY
  ↓
Create/Update Supabase User
  ↓
Create/Update Profile
  ↓
Redirect to /dashboard
```

---

## 🚨 Most Common Issues

### Issue 1: "Invalid access token"
**Cause**: Access token đã hết hạn (>1 giờ) hoặc sai format

**Fix**:
- Đừng reuse code authorization cũ
- Login lại từ đầu
- Check access_token được gửi đúng trong query param

### Issue 2: "Invalid redirect_uri"
**Cause**: Callback URL không match với Zalo Console

**Fix**:
```
Zalo Console: https://beta.cophieuluotsong.com/auth/callback
Code:         https://beta.cophieuluotsong.com/auth/callback
              ✅ MUST MATCH EXACTLY
```

### Issue 3: "Missing code_verifier"
**Cause**: SessionStorage bị clear hoặc PKCE flow sai

**Fix**:
- Check sessionStorage có `zalo_code_verifier` không
- Không clear session giữa redirect
- Test trong normal mode (không incognito)

### Issue 4: Network timeout
**Cause**: Zalo API slow hoặc network issues

**Fix**:
- Retry login
- Check internet connection
- Check firewall/proxy settings

---

## 📞 Next Steps

1. **Collect logs** từ:
   - Server logs (Vercel/terminal)
   - Browser console
   - Network tab responses

2. **Share with me**:
   - Error messages
   - Request/response details
   - Screenshots

3. **I will help** debug based on exact error!

---

## 🔧 Quick Debug Commands

```bash
# Check if app is running
curl https://beta.cophieuluotsong.com/api/health

# Check environment variables (local)
npm run env-check

# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build

# Test locally
npm run dev
```

---

**Last Updated**: 2025-01-16
