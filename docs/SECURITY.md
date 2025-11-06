# Security Best Practices - CPLS Application

Tài liệu này mô tả các biện pháp bảo mật được implement trong ứng dụng CPLS.

## Tổng quan

Ứng dụng CPLS xử lý thông tin nhạy cảm như:
- Thông tin tài khoản người dùng (email, tên, số điện thoại)
- Số tài khoản chứng khoán
- Access tokens từ Zalo OAuth
- Premium membership status

Việc bảo mật đúng cách là **CỰC KỲ QUAN TRỌNG**.

---

## 1. Environment Variables Security

### ✅ Nguyên tắc phân loại

**Public Variables** (prefix `NEXT_PUBLIC_*`):
- Có thể nhìn thấy trong client-side JavaScript
- Không chứa thông tin nhạy cảm
- Ví dụ: `NEXT_PUBLIC_ZALO_APP_ID`, `NEXT_PUBLIC_SUPABASE_URL`

**Secret Variables** (không có prefix):
- Chỉ tồn tại ở server-side (API routes, serverless functions)
- KHÔNG BAO GIỜ bị expose ra client
- Ví dụ: `ZALO_APP_SECRET`, `GEMINI_API_KEY`

### ✅ Implementation

```typescript
// ✅ GOOD - Public variable for client
const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID

// ❌ BAD - Secret variable exposed to client
const appSecret = process.env.ZALO_APP_SECRET // This will be undefined in client!

// ✅ GOOD - Secret used in API route (server-side)
// app/api/auth/zalo/token/route.ts
export async function POST(request: NextRequest) {
  const appSecret = process.env.ZALO_APP_SECRET // ✅ Only available server-side
  // ...
}
```

### ✅ Verification

Kiểm tra secret không bị leak:

```bash
# Build production bundle
npm run build

# Search for secret in client bundle
grep -r "your_actual_secret" .next/static/

# Should return: NO MATCHES
# If found → FIX IMMEDIATELY
```

---

## 2. OAuth Security

### ✅ CSRF Protection

**Vấn đề**: Attacker có thể trick user vào việc authorize attacker's Zalo account

**Giải pháp**: State parameter

```typescript
// Generate random state before redirect
const state = generateRandomString()
sessionStorage.setItem('zalo_oauth_state', state)

// Redirect to Zalo with state
window.location.href = `https://oauth.zaloapp.com/v4/permission?state=${state}&...`

// Verify state in callback
const returnedState = urlParams.get('state')
const storedState = sessionStorage.getItem('zalo_oauth_state')

if (returnedState !== storedState) {
  throw new Error('CSRF attack detected!')
}
```

### ✅ Server-side Token Exchange

**Vấn đề**: `ZALO_APP_SECRET` cần thiết để exchange authorization code

**Giải pháp**: API route xử lý ở server

```typescript
// ❌ BAD - Token exchange on client (exposes secret)
const response = await fetch('https://oauth.zaloapp.com/v4/access_token', {
  headers: { 'secret_key': ZALO_APP_SECRET } // ⚠️ Secret exposed!
})

// ✅ GOOD - Token exchange via API route
const response = await fetch('/api/auth/zalo/token', {
  method: 'POST',
  body: JSON.stringify({ code })
})
// API route handles secret server-side
```

### ✅ Redirect URI Validation

**Vấn đề**: Attacker có thể redirect user đến malicious site

**Giải pháp**: Whitelist redirect URIs trong Zalo Console

```
✅ Allowed:
https://cpls.yourdomain.com/auth/callback
https://staging.cpls.yourdomain.com/auth/callback
http://localhost:3000/auth/callback (dev only)

❌ Not allowed:
https://evil.com/callback
https://cpls.yourdomain.com/evil/callback
```

---

## 3. Database Security (Supabase)

### ✅ Row Level Security (RLS)

**Enable RLS** cho mọi table:

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### ✅ Anon Key vs Service Role Key

```typescript
// ✅ GOOD - Anon key for client (RLS enforced)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // ✅ Public, RLS protected
)

// ❌ BAD - Service role key on client (bypasses RLS!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ NEVER use on client!
)
```

### ✅ Secure Queries

```typescript
// ✅ GOOD - RLS automatically filters to current user
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId) // RLS ensures userId matches auth.uid()

// ❌ BAD - Trying to access other users (will fail with RLS)
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', 'another-user-id') // ⚠️ RLS blocks this
```

---

## 4. Input Validation & Sanitization

### ✅ Validate all inputs

```typescript
// Email validation
export function validateEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Email không được để trống' }
  }
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Email không hợp lệ' }
  }
  return { valid: true }
}

// Password validation
export function validatePassword(password: string) {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' }
  }
  return { valid: true }
}
```

### ✅ Sanitize HTML/XSS

```typescript
// Remove dangerous characters
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '')  // Remove <
    .replace(/>/g, '')  // Remove >
    .trim()
}

// Usage
const sanitizedName = sanitizeInput(userInput)
await supabase.from('profiles').update({ full_name: sanitizedName })
```

### ❌ Never trust user input

```typescript
// ❌ BAD - Direct SQL injection vulnerability
const query = `SELECT * FROM profiles WHERE name = '${userName}'`

// ✅ GOOD - Parameterized query (Supabase handles this)
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('name', userName) // ✅ Safe, automatically escaped
```

---

## 5. Authentication & Authorization

### ✅ Protected Routes

```typescript
// Always wrap protected pages
export default function SecretPage() {
  return (
    <ProtectedRoute requirePremium>
      <div>Premium content here</div>
    </ProtectedRoute>
  )
}
```

### ✅ Server-side checks

```typescript
// ❌ BAD - Client-side only check (can be bypassed)
if (userRole === 'premium') {
  showPremiumContent()
}

// ✅ GOOD - Server-side verification
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('membership')
    .eq('id', session.user.id)
    .single()

  if (profile.membership !== 'premium') {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 })
  }

  // Continue with premium logic
}
```

### ✅ Membership expiration check

```typescript
export async function isPremium(userId: string): Promise<boolean> {
  const { profile } = await getProfile(userId)
  if (!profile || profile.membership !== 'premium') return false

  // Check expiration
  if (profile.membership_expires_at) {
    const expiresAt = new Date(profile.membership_expires_at)
    const now = new Date()
    if (expiresAt <= now) {
      return false // Expired
    }
  }

  return true
}
```

---

## 6. HTTPS & Transport Security

### ✅ Force HTTPS in production

```typescript
// next.config.js
module.exports = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://cpls.yourdomain.com/:path*',
        permanent: true,
      },
    ]
  },
}
```

### ✅ Security headers

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Prevent clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevent MIME sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}
```

---

## 7. Error Handling

### ✅ Don't leak sensitive info

```typescript
// ❌ BAD - Exposes system details
catch (error) {
  return NextResponse.json({
    error: error.message, // Might contain sensitive info
    stack: error.stack     // ⚠️ Exposes code structure
  })
}

// ✅ GOOD - Generic error message
catch (error) {
  console.error('Internal error:', error) // Log server-side only
  return NextResponse.json({
    error: 'An error occurred. Please try again.' // Generic message
  }, { status: 500 })
}
```

### ✅ Log securely

```typescript
// ❌ BAD - Logs sensitive data
console.log('User login:', { email, password, token })

// ✅ GOOD - Log non-sensitive info only
console.log('User login attempt:', { email, success: true, timestamp: Date.now() })
```

---

## 8. Rate Limiting

### ✅ Prevent brute force attacks

```typescript
// Using Vercel Edge Config for rate limiting
import { ratelimit } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1'

  const { success } = await ratelimit.limit(ip)

  if (!success) {
    return NextResponse.json({
      error: 'Too many requests'
    }, { status: 429 })
  }

  // Continue with normal flow
}
```

### ✅ Implement exponential backoff

```typescript
// Client-side retry logic
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error

      const delay = Math.pow(2, i) * 1000 // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

---

## 9. Dependency Security

### ✅ Keep dependencies updated

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

### ✅ Use lock files

```bash
# Commit package-lock.json
git add package-lock.json
git commit -m "chore: update dependencies"
```

### ✅ Review dependencies

```bash
# Check what each package does
npm ls

# Remove unused dependencies
npm prune
```

---

## 10. Monitoring & Logging

### ✅ Set up error tracking

```typescript
// Sentry integration
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV,
  beforeSend(event) {
    // Remove sensitive data before sending
    if (event.request) {
      delete event.request.cookies
      delete event.request.headers?.authorization
    }
    return event
  },
})
```

### ✅ Monitor failed login attempts

```typescript
// Track suspicious activity
async function trackFailedLogin(email: string, ip: string) {
  const count = await redis.incr(`failed_login:${ip}`)

  if (count > 5) {
    // Alert admin
    await sendAlert('Multiple failed logins', { email, ip })

    // Temporary block
    await redis.setex(`blocked:${ip}`, 3600, '1')
  }
}
```

---

## Security Checklist

Trước khi go live production:

### Authentication & Authorization
- [ ] RLS enabled cho tất cả Supabase tables
- [ ] Protected routes kiểm tra auth ở server-side
- [ ] Membership expiration được verify
- [ ] Password có độ dài tối thiểu 6 ký tự
- [ ] Không store passwords plain text

### OAuth Security
- [ ] State parameter được verify (CSRF protection)
- [ ] Token exchange ở server-side only
- [ ] Redirect URIs được whitelist trong Zalo Console
- [ ] Access tokens không bị log hoặc expose

### Environment Variables
- [ ] `ZALO_APP_SECRET` không có prefix `NEXT_PUBLIC_`
- [ ] Secrets không được commit vào Git
- [ ] `.env.local` trong `.gitignore`
- [ ] Production variables được set trong Vercel

### Transport Security
- [ ] HTTPS enforced trong production
- [ ] Security headers configured
- [ ] No mixed content (HTTP resources on HTTPS page)

### Input Validation
- [ ] Email format validation
- [ ] Password strength requirements
- [ ] HTML/XSS sanitization
- [ ] SQL injection protection (via Supabase ORM)

### Error Handling
- [ ] Generic error messages (no sensitive info leak)
- [ ] Errors logged server-side only
- [ ] Stack traces not exposed to client

### Monitoring
- [ ] Error tracking configured (Sentry)
- [ ] Failed login attempts monitored
- [ ] Vercel Analytics enabled

---

## Incident Response

Nếu phát hiện security breach:

1. **Immediate Actions**
   - Revoke exposed credentials immediately
   - Rotate all API keys và secrets
   - Invalidate all user sessions

2. **Investigation**
   - Check Vercel logs for suspicious activity
   - Review Supabase audit logs
   - Identify scope of breach

3. **Communication**
   - Notify affected users (nếu PII bị leak)
   - Update security documentation
   - Post-mortem analysis

4. **Prevention**
   - Patch vulnerability
   - Deploy fix immediately
   - Add monitoring/alerts

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

**Security is everyone's responsibility. Stay vigilant! 🔒**
