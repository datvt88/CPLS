# 🔐 Authentication System Analysis & Optimization

## 📊 Current Implementation Analysis

### ✅ Strengths

1. **Cookie + localStorage Dual Storage**
   - Custom CookieStorage class
   - 30-day expiry
   - Fallback mechanism

2. **Session Keepalive**
   - Auto-refresh every 50 minutes
   - Prevents token expiration
   - Good UX

3. **PKCE Flow**
   - Secure OAuth flow
   - No client secret needed

4. **Middleware Protection**
   - Basic route protection
   - No redirect conflicts

### ⚠️ Weaknesses & Security Concerns

1. **Client-Side Only Session Storage**
   - Cookie chỉ lưu ở client
   - Không có server-side validation
   - Không track active sessions

2. **No Session Revocation**
   - Không thể force logout user
   - Không thể revoke sessions remotely
   - Không quản lý được multiple devices

3. **Limited Security**
   - Cookie không HttpOnly (JavaScript có thể đọc)
   - Không có fingerprinting
   - Không detect suspicious activity

4. **No Device Management**
   - User không biết devices nào đang login
   - Không thể logout from specific device
   - Không track device info

5. **Performance Issues**
   - Session check mỗi lần navigate
   - Không có caching
   - Multiple getSession() calls

---

## 🚀 Recommended Architecture

### **Option 1: Supabase Auth with Server-Side Session (RECOMMENDED)**

**Pros:**
- ✅ Built-in session management
- ✅ Server-side validation
- ✅ Automatic token refresh
- ✅ Row Level Security (RLS)
- ✅ No need custom backend

**Cons:**
- ❌ Tied to Supabase ecosystem
- ❌ Limited customization

**Implementation:**
```typescript
// Use Supabase Auth sessions table (built-in)
// Enable RLS on sessions
// Track sessions in custom table for analytics
```

---

### **Option 2: Custom Session Table + Supabase Auth**

**Pros:**
- ✅ Full control over session data
- ✅ Device tracking
- ✅ Session analytics
- ✅ Custom expiry logic

**Cons:**
- ❌ More code to maintain
- ❌ Need to sync with Supabase Auth

**Implementation:**
```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  device_name text,
  device_type text,
  ip_address inet,
  user_agent text,
  last_activity timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

---

### **Option 3: Redis + Supabase (For High Traffic)**

**Pros:**
- ✅ Extremely fast
- ✅ Built-in TTL
- ✅ Perfect for sessions
- ✅ Scalable

**Cons:**
- ❌ Need Redis server (cost)
- ❌ More infrastructure
- ❌ Overkill for small apps

---

## 💡 RECOMMENDED SOLUTION

**Hybrid Approach: Supabase Auth + Custom Session Tracking**

Sử dụng Supabase Auth làm core, thêm custom table để:
- Track active sessions
- Device management
- Analytics
- Security monitoring

---

## 🎯 Implementation Plan

### Phase 1: Database Schema

```sql
-- Sessions tracking table
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  refresh_token text,

  -- Device info
  device_name text,
  device_type text, -- 'desktop', 'mobile', 'tablet'
  browser text,
  os text,

  -- Security
  ip_address inet,
  user_agent text,
  fingerprint text,

  -- Tracking
  last_activity timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,

  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- RLS policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own sessions (logout)
CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE user_sessions
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Cron job to run cleanup daily (if pg_cron is available)
-- SELECT cron.schedule('cleanup-sessions', '0 0 * * *', 'SELECT cleanup_expired_sessions()');
```

### Phase 2: Enhanced Supabase Client

```typescript
// lib/supabase-session.ts
import { supabase } from './supabaseClient'

export interface DeviceInfo {
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
}

export interface SessionInfo {
  id: string
  device_name: string
  device_type: string
  browser: string
  os: string
  ip_address: string
  last_activity: string
  created_at: string
  is_current: boolean
}

/**
 * Get device information from user agent
 */
export function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent

  // Detect device type
  const isMobile = /Mobile|Android|iPhone/i.test(ua)
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua)
  const type = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'

  // Detect browser
  let browser = 'Unknown'
  if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edge')) browser = 'Edge'

  // Detect OS
  let os = 'Unknown'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS'

  return {
    name: `${browser} on ${os}`,
    type,
    browser,
    os
  }
}

/**
 * Create session record in database
 */
export async function createSessionRecord(userId: string, sessionToken: string) {
  const deviceInfo = getDeviceInfo()

  // Get IP address from client (or use server-side API)
  const ipResponse = await fetch('https://api.ipify.org?format=json').catch(() => null)
  const ipData = ipResponse ? await ipResponse.json() : null
  const ipAddress = ipData?.ip || 'unknown'

  const { data, error } = await supabase
    .from('user_sessions')
    .insert({
      user_id: userId,
      session_token: sessionToken,
      device_name: deviceInfo.name,
      device_type: deviceInfo.type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      ip_address: ipAddress,
      user_agent: navigator.userAgent,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create session record:', error)
    return null
  }

  return data
}

/**
 * Update session activity
 */
export async function updateSessionActivity(sessionToken: string) {
  const { error } = await supabase
    .from('user_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_token', sessionToken)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to update session activity:', error)
  }
}

/**
 * Get all active sessions for current user
 */
export async function getActiveSessions(): Promise<SessionInfo[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []

  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .order('last_activity', { ascending: false })

  if (error) {
    console.error('Failed to get sessions:', error)
    return []
  }

  // Mark current session
  const currentToken = session.access_token

  return data.map(s => ({
    id: s.id,
    device_name: s.device_name,
    device_type: s.device_type,
    browser: s.browser,
    os: s.os,
    ip_address: s.ip_address,
    last_activity: s.last_activity,
    created_at: s.created_at,
    is_current: s.session_token === currentToken
  }))
}

/**
 * Revoke specific session
 */
export async function revokeSession(sessionId: string) {
  const { error } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

  if (error) {
    console.error('Failed to revoke session:', error)
    throw error
  }
}

/**
 * Revoke all sessions except current
 */
export async function revokeAllOtherSessions() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const currentToken = session.access_token

  const { error } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', session.user.id)
    .neq('session_token', currentToken)

  if (error) {
    console.error('Failed to revoke sessions:', error)
    throw error
  }
}
```

### Phase 3: Enhanced AuthListener

```typescript
// components/EnhancedAuthListener.tsx
'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { createSessionRecord, updateSessionActivity } from '@/lib/supabase-session'

export default function EnhancedAuthListener() {
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const sessionTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    // Initialize session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && mounted) {
        await handleSessionStart(session)
      }
    })

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('Auth state changed:', event)

        if (event === 'SIGNED_IN' && session) {
          await handleSessionStart(session)
        } else if (event === 'SIGNED_OUT') {
          handleSessionEnd()
        } else if (event === 'TOKEN_REFRESHED' && session) {
          console.log('✅ Token refreshed successfully')
          // Update session token
          sessionTokenRef.current = session.access_token
        }
      }
    )

    // Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
      stopKeepAlive()
      stopActivityTracking()
    }
  }, [])

  const handleSessionStart = async (session: any) => {
    const sessionToken = session.access_token
    sessionTokenRef.current = sessionToken

    // Create session record in database
    await createSessionRecord(session.user.id, sessionToken)

    // Sync user profile
    await syncUserProfile(session.user)

    // Start keepalive and activity tracking
    startKeepAlive()
    startActivityTracking()
  }

  const handleSessionEnd = () => {
    sessionTokenRef.current = null
    stopKeepAlive()
    stopActivityTracking()
  }

  const startKeepAlive = () => {
    if (keepAliveIntervalRef.current) return

    keepAliveIntervalRef.current = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          console.log('🔄 Refreshing session...')
          const { data, error } = await supabase.auth.refreshSession()

          if (!error && data.session) {
            console.log('✅ Session refreshed successfully')
            sessionTokenRef.current = data.session.access_token
          }
        } else {
          stopKeepAlive()
        }
      } catch (error) {
        console.error('Keepalive error:', error)
      }
    }, 50 * 60 * 1000) // 50 minutes

    console.log('🔐 Session keepalive started')
  }

  const stopKeepAlive = () => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current)
      keepAliveIntervalRef.current = null
      console.log('🔓 Session keepalive stopped')
    }
  }

  const startActivityTracking = () => {
    if (activityIntervalRef.current) return

    // Update activity every 5 minutes
    activityIntervalRef.current = setInterval(async () => {
      if (sessionTokenRef.current) {
        await updateSessionActivity(sessionTokenRef.current)
      }
    }, 5 * 60 * 1000) // 5 minutes

    console.log('📊 Activity tracking started')
  }

  const stopActivityTracking = () => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current)
      activityIntervalRef.current = null
      console.log('📊 Activity tracking stopped')
    }
  }

  return null
}

async function syncUserProfile(user: any) {
  // ... existing sync logic
}
```

---

## 🔒 Security Improvements

### 1. Server-Side Session Validation Middleware

```typescript
// middleware.ts (enhanced)
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes
  const publicRoutes = ['/', '/login', '/pricing', '/auth/callback']
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Get token from cookie
  const token = request.cookies.get('cpls-auth-token')?.value

  if (!token) {
    console.log('⚠️ No auth token for:', pathname)
    return NextResponse.next()
  }

  try {
    // Parse token to get session token
    const parsedToken = JSON.parse(token)
    const sessionToken = parsedToken.access_token

    // Validate session in database (server-side)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: sessionData, error } = await supabase
      .from('user_sessions')
      .select('is_active, expires_at')
      .eq('session_token', sessionToken)
      .single()

    if (error || !sessionData) {
      console.log('❌ Invalid session in database')
      return NextResponse.next()
    }

    if (!sessionData.is_active) {
      console.log('❌ Session revoked')
      // Clear cookie
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('cpls-auth-token')
      return response
    }

    if (new Date(sessionData.expires_at) < new Date()) {
      console.log('❌ Session expired')
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('cpls-auth-token')
      return response
    }

    console.log('✅ Session validated')
  } catch (error) {
    console.error('Session validation error:', error)
  }

  return NextResponse.next()
}
```

### 2. HttpOnly Cookies (Server-Side Only)

```typescript
// app/api/auth/set-cookie/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const { session } = await request.json()

  // Set HttpOnly cookie (JavaScript cannot access)
  cookies().set('session-token', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/'
  })

  return NextResponse.json({ success: true })
}
```

---

## 📱 Device Management Component

```typescript
// components/DeviceManagement.tsx
'use client'
import { useState, useEffect } from 'react'
import { getActiveSessions, revokeSession, revokeAllOtherSessions, SessionInfo } from '@/lib/supabase-session'

export default function DeviceManagement() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    const data = await getActiveSessions()
    setSessions(data)
    setLoading(false)
  }

  const handleRevoke = async (sessionId: string) => {
    if (!confirm('Logout from this device?')) return

    try {
      await revokeSession(sessionId)
      await loadSessions()
    } catch (error) {
      alert('Failed to revoke session')
    }
  }

  const handleRevokeAll = async () => {
    if (!confirm('Logout from all other devices?')) return

    try {
      await revokeAllOtherSessions()
      await loadSessions()
    } catch (error) {
      alert('Failed to revoke sessions')
    }
  }

  return (
    <div className="bg-[--panel] p-6 rounded-xl border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Active Devices</h2>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAll}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
          >
            Logout All Other Devices
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`p-4 rounded-lg border ${
                session.is_current
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">
                    {session.device_type === 'mobile' ? '📱' :
                     session.device_type === 'tablet' ? '📱' : '💻'}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {session.device_name}
                      {session.is_current && (
                        <span className="ml-2 text-xs bg-green-500 text-white px-2 py-1 rounded">
                          Current Device
                        </span>
                      )}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {session.browser} • {session.os}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      Last active: {new Date(session.last_activity).toLocaleString('vi-VN')}
                    </p>
                    <p className="text-gray-500 text-xs">
                      IP: {session.ip_address}
                    </p>
                  </div>
                </div>

                {!session.is_current && (
                  <button
                    onClick={() => handleRevoke(session.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
          ))}

          {sessions.length === 0 && (
            <p className="text-gray-400 text-center py-8">No active sessions</p>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## 📊 Performance Improvements

1. **Session Caching**
2. **Lazy Loading**
3. **Debounced Activity Updates**
4. **Optimistic UI Updates**

---

## 🎯 Summary

### Current Issues:
❌ Client-only session storage
❌ No session revocation
❌ No device management
❌ Limited security

### Recommended Solution:
✅ Supabase Auth + Custom Sessions Table
✅ Server-side validation
✅ Device tracking & management
✅ HttpOnly cookies option
✅ Activity monitoring
✅ Session analytics

### Benefits:
- 🔒 Better security
- 📊 User insights
- 🎛️ Admin control
- 📱 Device management
- ⚡ Better performance

---

**Next Steps:**
1. Run migration to create sessions table
2. Implement EnhancedAuthListener
3. Add DeviceManagement to profile page
4. Test session revocation
5. Monitor analytics
