# Hướng dẫn cấu hình Supabase Email Authentication

## 🎯 Tổng quan

Hướng dẫn này sẽ giúp bạn cấu hình Email Authentication với Email Verification trên Supabase Dashboard để tránh spam và đảm bảo người dùng sử dụng email thật.

## ✅ Tính năng đã tích hợp

- ✅ Email & Password Authentication
- ✅ Email Verification (xác thực email)
- ✅ Auto-redirect sau khi verify email
- ✅ Custom email templates
- ✅ Chống spam tự động

---

## 📋 Bước 1: Truy cập Supabase Dashboard

1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
2. Chọn project của bạn (CPLS)
3. Click vào **Authentication** ở sidebar bên trái

---

## 📧 Bước 2: Cấu hình Email Settings

### 2.1. Bật Email Provider

1. Vào **Authentication** → **Providers**
2. Tìm **Email** trong danh sách providers
3. Đảm bảo **Email** đã được **ENABLED** (toggle màu xanh)

### 2.2. Cấu hình Email Confirmation

1. Vào **Authentication** → **Settings** (hoặc **Email Templates**)
2. Scroll xuống phần **Email Confirmation**
3. **BẬT** tùy chọn **"Enable email confirmations"**

   ```
   ☑️ Enable email confirmations
   ```

4. **Quan trọng**: Cấu hình **Confirmation URL**:

   ```
   {{ .SiteURL }}/auth/callback
   ```

   Hoặc nếu có custom domain:

   ```
   https://yourdomain.com/auth/callback
   ```

### 2.3. Site URL Configuration

1. Vào **Authentication** → **URL Configuration**
2. Cập nhật **Site URL**:

   **Development:**
   ```
   http://localhost:3000
   ```

   **Production:**
   ```
   https://yourdomain.com
   ```

3. Thêm **Redirect URLs** (phân cách bằng dấu phẩy):

   ```
   http://localhost:3000/auth/callback,
   https://yourdomain.com/auth/callback
   ```

---

## 📝 Bước 3: Tùy chỉnh Email Templates (Tùy chọn)

### 3.1. Confirm Signup Email

1. Vào **Authentication** → **Email Templates**
2. Chọn **Confirm signup**
3. Customize email template (Tiếng Việt):

```html
<h2>Xác nhận đăng ký tài khoản CPLS</h2>

<p>Chào bạn,</p>

<p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Cổ Phiếu Lướt Sóng</strong>!</p>

<p>Vui lòng click vào link bên dưới để xác thực địa chỉ email của bạn:</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="background-color: #10b981; color: white; padding: 12px 24px;
            text-decoration: none; border-radius: 8px; display: inline-block;">
    Xác thực Email
  </a>
</p>

<p>Hoặc copy link này vào trình duyệt:</p>
<p>{{ .ConfirmationURL }}</p>

<p><small>Link này sẽ hết hạn sau 24 giờ.</small></p>

<hr>

<p style="color: #666; font-size: 12px;">
  Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
</p>
```

4. Click **Save**

### 3.2. Magic Link Email (Tùy chọn)

Nếu bạn muốn sử dụng Magic Link (passwordless login):

```html
<h2>Đăng nhập CPLS - Magic Link</h2>

<p>Chào bạn,</p>

<p>Click vào nút bên dưới để đăng nhập vào tài khoản CPLS của bạn:</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="background-color: #7c3aed; color: white; padding: 12px 24px;
            text-decoration: none; border-radius: 8px; display: inline-block;">
    Đăng nhập ngay
  </a>
</p>

<p><small>Link này sẽ hết hạn sau 1 giờ.</small></p>
```

---

## 🔒 Bước 4: Cấu hình bảo mật chống spam

### 4.1. Rate Limiting

1. Vào **Authentication** → **Rate Limits**
2. Cấu hình giới hạn:

```
Email Sign Up: 10 requests / hour
Email Sign In: 20 requests / hour
Password Reset: 5 requests / hour
```

### 4.2. Email Restrictions (Optional)

Nếu muốn chặn email tạm thời:

1. Vào **Authentication** → **Settings**
2. Scroll xuống **Email Restrictions**
3. Thêm domains bị chặn:

```
tempmail.com
guerrillamail.com
10minutemail.com
mailinator.com
```

### 4.3. CAPTCHA (Recommended)

**Tích hợp Google reCAPTCHA v3:**

1. Vào **Authentication** → **Settings**
2. Scroll xuống **CAPTCHA Protection**
3. Bật **Enable CAPTCHA**
4. Nhập:
   - **reCAPTCHA Site Key**: `your_site_key`
   - **reCAPTCHA Secret Key**: `your_secret_key`

Lấy keys từ: [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)

---

## 🧪 Bước 5: Test Email Verification

### 5.1. Local Testing

1. Start development server:
   ```bash
   npm run dev
   ```

2. Mở `http://localhost:3000/login`

3. Chuyển sang chế độ **Đăng ký**

4. Nhập thông tin:
   - Email: `test@example.com`
   - Password: `Test123!@#`
   - Phone: `0912345678`

5. Click **Đăng ký**

6. Kiểm tra inbox email (hoặc Supabase Dashboard → **Authentication** → **Logs**)

### 5.2. Supabase Inbucket (Development)

**Supabase cung cấp email testing miễn phí trong development:**

1. Vào **Authentication** → **Email Templates**
2. Click **Inbucket** (icon 📧 ở góc phải)
3. Xem tất cả emails được gửi trong development
4. Click vào email confirmation để test

### 5.3. Verify Flow

1. User đăng ký → Supabase gửi email
2. User click link trong email
3. Redirect về `/auth/callback` với token
4. Callback page xử lý và login user
5. Redirect về `/dashboard`

---

## 📊 Bước 6: Monitor & Logs

### 6.1. Authentication Logs

1. Vào **Authentication** → **Logs**
2. Xem:
   - Sign up events
   - Email confirmation events
   - Login attempts
   - Errors

### 6.2. User Management

1. Vào **Authentication** → **Users**
2. Kiểm tra:
   - ✅ **Email Confirmed**: Màu xanh = đã verify
   - ⏳ **Email Confirmed**: Màu xám = chưa verify
   - ❌ **Banned**: User bị chặn

### 6.3. Manually Confirm Email (Admin)

Nếu cần confirm email thủ công:

1. Vào **Authentication** → **Users**
2. Click vào user
3. Toggle **Email Confirmed** → ON

---

## 🚀 Bước 7: Production Checklist

Trước khi deploy production:

- [ ] Cấu hình **Site URL** đúng production domain
- [ ] Thêm **Redirect URLs** cho production
- [ ] Customize **Email Templates** (branding, tiếng Việt)
- [ ] Bật **Rate Limiting**
- [ ] Cấu hình **CAPTCHA** (recommend)
- [ ] Test email verification flow
- [ ] Setup **Custom SMTP** (optional, cho branded emails)

---

## 🎨 Bước 8: Custom SMTP (Tùy chọn)

Để gửi email từ domain riêng (thay vì Supabase):

### 8.1. Chuẩn bị

- Gmail, SendGrid, AWS SES, hoặc SMTP provider khác
- SMTP credentials (host, port, username, password)

### 8.2. Cấu hình

1. Vào **Project Settings** → **Authentication**
2. Scroll xuống **SMTP Settings**
3. Bật **Enable Custom SMTP**
4. Nhập thông tin:

**Gmail Example:**
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Pass: your-app-password
Sender Name: CPLS
Sender Email: noreply@yourdomain.com
```

**SendGrid Example:**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Pass: YOUR_SENDGRID_API_KEY
Sender Name: Cổ Phiếu Lướt Sóng
Sender Email: noreply@cpls.app
```

5. Click **Save**
6. Click **Send Test Email** để test

---

## ❓ Troubleshooting

### Email không được gửi

1. Kiểm tra **Authentication** → **Logs** để xem errors
2. Verify **Site URL** và **Redirect URLs** đúng
3. Kiểm tra spam folder
4. Nếu dùng Custom SMTP, verify credentials

### User không thể login sau khi verify

1. Vào **Authentication** → **Users**
2. Kiểm tra **Email Confirmed** = true
3. Nếu false, manually confirm

### Rate limit errors

1. Tăng rate limits trong **Authentication** → **Rate Limits**
2. Hoặc wait 1 giờ để reset

### Email bị spam filter

1. Setup SPF/DKIM records (nếu dùng custom domain)
2. Sử dụng Custom SMTP provider uy tín
3. Customize email content để tránh spam keywords

---

## 🔗 Tài liệu tham khảo

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Rate Limiting](https://supabase.com/docs/guides/auth/rate-limits)

---

## 💡 Tips

1. **Development**: Dùng Supabase Inbucket để test emails
2. **Production**: Dùng Custom SMTP cho branded emails
3. **Security**: Luôn bật Rate Limiting
4. **UX**: Customize email templates cho professional look
5. **Monitoring**: Regularly check Authentication Logs

---

**Hoàn thành! 🎉**

Email Authentication với Email Verification đã được cấu hình xong. Người dùng giờ phải xác thực email trước khi sử dụng tài khoản, giúp chống spam hiệu quả!
