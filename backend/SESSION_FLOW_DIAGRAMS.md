# Cloud Run Session Flow - Visual Guide

## Architecture Overview

```
┌──────────────┐         HTTPS          ┌─────────────────┐
│              │ ────────────────────► │   Cloud Run     │
│   Browser    │                        │  Load Balancer  │
│              │ ◄──────────────────── │   (Proxy)       │
└──────────────┘     Cookie Set         └─────────────────┘
                                                │
                                                │ X-Forwarded-Proto: https
                                                │ HTTP (internal)
                                                ▼
                                        ┌─────────────────┐
                                        │   Go App        │
                                        │   (Gin)         │
                                        │                 │
                                        │   Port: 8080    │
                                        └─────────────────┘
```

## Login Flow (Fixed)

### Before Fix ❌
```
1. User → Login Form
   POST /admin/login
   ├─ Username: admin
   └─ Password: admin123

2. Server validates ✅
   └─ Credentials correct

3. Server tries to set cookie
   ├─ Sees HTTP connection (internal)
   ├─ Cookie has Secure: true
   └─ ❌ Cookie NOT set (HTTP vs HTTPS mismatch)

4. Server redirects
   └─ Location: /admin/dashboard

5. Browser requests dashboard
   GET /admin/dashboard
   └─ ❌ No cookie sent

6. Server checks session
   ├─ No session found
   └─ Redirect to /admin/login

7. 🔄 LOOP FOREVER
```

### After Fix ✅
```
1. User → Login Form
   POST /admin/login
   ├─ Username: admin
   └─ Password: admin123

2. Server validates ✅
   └─ Credentials correct

3. Server sets cookie
   ├─ Trusts proxy (SetTrustedProxies)
   ├─ Reads X-Forwarded-Proto: https
   ├─ Cookie has Secure: true
   └─ ✅ Cookie SET successfully

4. Server redirects
   └─ Location: /admin/dashboard
   └─ Set-Cookie: admin_session=xyz...

5. Browser requests dashboard
   GET /admin/dashboard
   └─ Cookie: admin_session=xyz...

6. Server checks session
   ├─ ✅ Session found
   ├─ User: admin
   └─ Render dashboard

7. ✅ SUCCESS - User sees dashboard
```

## Session Configuration Flow

```
main.go initialization:
│
├─ Load environment variables
│  ├─ SESSION_SECRET (required in production)
│  ├─ ADMIN_USERNAME (default: admin)
│  └─ ADMIN_PASSWORD (default: admin123)
│
├─ Configure Gin Router
│  └─ router.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"}) ← CRITICAL for Cloud Run
│
├─ Create Session Store
│  └─ cookie.NewStore([]byte(sessionSecret))
│
├─ Configure Session Options
│  ├─ Path: "/"
│  ├─ Domain: "" ← Empty for *.run.app
│  ├─ MaxAge: 7 days
│  ├─ Secure: true ← HTTPS only
│  ├─ HttpOnly: true ← XSS protection
│  └─ SameSite: Lax ← CSRF protection
│
└─ Apply Middleware
   └─ router.Use(sessions.Sessions("admin_session", store))
```

## Request Flow with Middleware

```
Incoming Request
│
├─ CORS Middleware
│  └─ Set CORS headers
│
├─ Session Middleware
│  ├─ Read cookie from request
│  ├─ Decrypt with SESSION_SECRET
│  ├─ Load session data
│  └─ Store in context
│
├─ Route Matching
│  │
│  ├─ /admin/login (Public)
│  │  └─ No auth required
│  │
│  └─ /admin/dashboard (Protected)
│     │
│     └─ AuthRequired Middleware
│        ├─ Get session from context
│        ├─ Check for "user" key
│        │
│        ├─ If found ✅
│        │  └─ Continue to handler
│        │
│        └─ If not found ❌
│           ├─ Redirect to /admin/login
│           └─ Abort request
│
└─ Handler Execution
   └─ Render response
```

## Cookie Attributes Explained

```
Set-Cookie: admin_session=abc123...; Path=/; Secure; HttpOnly; SameSite=Lax

┌─────────────────────────────────────────────────────────┐
│ admin_session=abc123...                                 │
│ └─ Encrypted session data                              │
│                                                          │
│ Path=/                                                   │
│ └─ Cookie sent for all paths on domain                 │
│                                                          │
│ Secure                                                   │
│ └─ Cookie only sent over HTTPS                         │
│    (Cloud Run terminates HTTPS at load balancer)       │
│                                                          │
│ HttpOnly                                                 │
│ └─ Cookie not accessible via JavaScript               │
│    (Prevents XSS attacks)                              │
│                                                          │
│ SameSite=Lax                                            │
│ └─ Cookie sent for same-site requests                 │
│    (Prevents CSRF while allowing navigation)           │
└─────────────────────────────────────────────────────────┘
```

## Proxy Trust Mechanism

```
Without SetTrustedProxies (or with nil/empty):
┌──────────────────────────────────────────────┐
│ Cloud Run Load Balancer                      │
│ X-Forwarded-Proto: https                     │
│ X-Forwarded-For: 203.0.113.1                │
└──────────────────┬───────────────────────────┘
                   │ HTTP
                   ▼
┌──────────────────────────────────────────────┐
│ Go App (Gin)                                 │
│ ├─ Gin sees: HTTP request                   │
│ ├─ Gin ignores X-Forwarded-* headers        │
│ └─ ❌ Won't set Secure cookies               │
└──────────────────────────────────────────────┘

With SetTrustedProxies([]string{"0.0.0.0/0", "::/0"}):
┌──────────────────────────────────────────────┐
│ Cloud Run Load Balancer                      │
│ X-Forwarded-Proto: https                     │
│ X-Forwarded-For: 203.0.113.1                │
└──────────────────┬───────────────────────────┘
                   │ HTTP
                   ▼
┌──────────────────────────────────────────────┐
│ Go App (Gin)                                 │
│ ├─ Gin trusts proxy                         │
│ ├─ Gin reads X-Forwarded-Proto: https       │
│ ├─ Gin treats connection as HTTPS           │
│ └─ ✅ Sets Secure cookies                    │
└──────────────────────────────────────────────┘
```

## Session Secret Importance

```
Scenario 1: No SESSION_SECRET set (Random each restart)
┌────────────────────────────────────────────┐
│ App Start #1                               │
│ └─ Secret: xyz123... (random)             │
│    └─ User logs in                        │
│       └─ Session encrypted with xyz123    │
└────────────────────────────────────────────┘
         │
         │ App restarts (deploy, scale, crash)
         ▼
┌────────────────────────────────────────────┐
│ App Start #2                               │
│ └─ Secret: abc789... (NEW random)         │
│    └─ User request with old session       │
│       ├─ Tries to decrypt with abc789     │
│       └─ ❌ FAILS - different key          │
│          └─ Session lost, redirect login  │
└────────────────────────────────────────────┘

Scenario 2: SESSION_SECRET from environment
┌────────────────────────────────────────────┐
│ App Start #1                               │
│ └─ Secret: ENV["SESSION_SECRET"]          │
│    └─ User logs in                        │
│       └─ Session encrypted with secret    │
└────────────────────────────────────────────┘
         │
         │ App restarts (deploy, scale, crash)
         ▼
┌────────────────────────────────────────────┐
│ App Start #2                               │
│ └─ Secret: ENV["SESSION_SECRET"] (SAME)   │
│    └─ User request with old session       │
│       ├─ Decrypts with same secret        │
│       └─ ✅ SUCCESS - session valid        │
│          └─ User stays logged in          │
└────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────┐
│ Browser                                         │
│ ├─ HTTPS encryption (TLS)                      │
│ │  └─ Prevents man-in-the-middle attacks       │
│ │                                               │
│ └─ Cookie Storage                               │
│    ├─ HttpOnly (no JavaScript access)          │
│    │  └─ Prevents XSS cookie theft             │
│    │                                            │
│    └─ SameSite=Lax                             │
│       └─ Prevents CSRF attacks                 │
└─────────────────────────────────────────────────┘
          │
          │ HTTPS
          ▼
┌─────────────────────────────────────────────────┐
│ Cloud Run Load Balancer                         │
│ ├─ TLS Termination                             │
│ └─ Adds X-Forwarded-Proto header               │
└─────────────────────────────────────────────────┘
          │
          │ HTTP (internal, secure network)
          ▼
┌─────────────────────────────────────────────────┐
│ Go Application                                  │
│ ├─ Trusts proxy                                │
│ │  └─ Reads X-Forwarded-Proto                  │
│ │                                               │
│ ├─ Session Encryption                          │
│ │  └─ AES encryption with SESSION_SECRET       │
│ │                                               │
│ └─ Authentication Middleware                    │
│    └─ Validates session on protected routes    │
└─────────────────────────────────────────────────┘
```

## Deployment Checklist

```
□ 1. Build Docker image
     └─ docker build -t gcr.io/$PROJECT_ID/cpls-crawler .

□ 2. Push to Container Registry
     └─ docker push gcr.io/$PROJECT_ID/cpls-crawler

□ 3. Generate SESSION_SECRET
     └─ openssl rand -base64 32

□ 4. Deploy to Cloud Run
     ├─ Set SESSION_SECRET (required)
     ├─ Set ADMIN_USERNAME (optional)
     └─ Set ADMIN_PASSWORD (optional)

□ 5. Test Login
     ├─ Visit https://your-app.run.app/admin/login
     ├─ Enter credentials
     └─ Verify dashboard access

□ 6. Verify Session Persistence
     ├─ Login
     ├─ Close browser
     ├─ Reopen browser
     └─ Visit dashboard (should still be logged in)

□ 7. Test Logout
     └─ Click logout → redirects to login
```

## Troubleshooting Decision Tree

```
Login Loop Issue?
│
├─ Yes → Check proxy trust
│  │     router.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"}) set?
│  │
│  ├─ No → ⚠️ Add it!
│  │
│  └─ Yes → Check cookie config
│     │     Secure: true in store.Options?
│     │
│     ├─ No → ⚠️ Set Secure: true
│     │
│     └─ Yes → Check SESSION_SECRET
│        │     Is it set in Cloud Run?
│        │
│        ├─ No → ⚠️ Set SESSION_SECRET env var
│        │
│        └─ Yes → Check logs
│           └─ gcloud run services logs read
│
└─ No → Sessions work! ✅
```

## Summary

```
╔════════════════════════════════════════════════════╗
║  Cloud Run Session Management Requirements        ║
╠════════════════════════════════════════════════════╣
║  1. SetTrustedProxies([]string{"0.0.0.0/0", "::/0"})  ✅ CRITICAL    ║
║  2. Secure: true                   ✅ REQUIRED    ║
║  3. HttpOnly: true                 ✅ SECURITY    ║
║  4. SameSite: Lax                  ✅ SECURITY    ║
║  5. SESSION_SECRET env var         ✅ CRITICAL    ║
║  6. Domain: "" (empty)             ✅ REQUIRED    ║
╚════════════════════════════════════════════════════╝
```
