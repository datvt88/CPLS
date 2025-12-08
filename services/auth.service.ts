import { supabase } from '@/lib/supabaseClient'
import { deviceService } from './device.service'
import { clearDeviceFingerprintCache } from '@/lib/session-manager'

export interface AuthCredentials {
  email: string
  password: string
}

export interface ZaloAuthOptions {
  redirectTo?: string
  scopes?: string
}

// Session cache to avoid repeated API calls
let sessionCache: {
  session: any | null
  user: any | null
  timestamp: number
} | null = null

// Giảm cache xuống 10s để dữ liệu luôn tươi mới khi chuyển tab
const SESSION_CACHE_TTL = 10 * 1000 
const API_TIMEOUT_MS = 7000 // 7s timeout tránh treo app

// Clear cache helper
function clearSessionCache() {
  sessionCache = null
}

// Helper: Timeout Wrapper
const withTimeout = <T>(promise: Promise<T>, ms: number = API_TIMEOUT_MS): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ]);
}

// Initialize listeners (runs once)
if (typeof window !== 'undefined') {
  // 1. Auth State Listener
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      sessionCache = {
        session,
        user: session?.user || null,
        timestamp: Date.now()
      }
    } else if (event === 'SIGNED_OUT') {
      clearSessionCache()
    }
  })

  // 2. Visibility Listener (Auto Refresh khi quay lại tab)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      console.log('👀 App visible - Refreshing session...')
      clearSessionCache() // Xóa cache cũ
      // Gọi getSession để Supabase tự động refresh token nếu cần
      await supabase.auth.getSession() 
    }
  })
}

export const authService = {
  /**
   * Sign up
   */
  async signUp({ email, password }: AuthCredentials) {
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback'

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl }
    })
    return { data, error }
  },

  /**
   * Sign in with Email
   */
  async signIn({ email, password }: AuthCredentials) {
    clearSessionCache()
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password })
      )
      
      if (data.user && !error) {
        this.trackUserDevice(data.user.id).catch(console.error)
      }
      return { data, error }
    } catch (err) {
      return { data: { user: null, session: null }, error: { message: 'Đăng nhập quá lâu, vui lòng thử lại' } as any }
    }
  },

  /**
   * Sign in with Phone
   */
  async signInWithPhone({ phoneNumber, password }: { phoneNumber: string; password: string }) {
    try {
      console.log('🔐 [Auth] Starting phone login:', phoneNumber)
      clearSessionCache()

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('/api/auth/signin-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const data = await response.json()

        if (!response.ok) {
          return { data: null, error: { message: data.error || 'Số điện thoại không tồn tại' } }
        }

        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: password,
        })

        if (error) {
          return { data: authData, error: { message: 'Mật khẩu không đúng' } }
        }

        if (authData.user) {
          this.trackUserDevice(authData.user.id).catch(console.error)
        }

        return { data: authData, error: null }

      } catch (fetchErr) {
        clearTimeout(timeoutId)
        return { data: null, error: { message: 'Lỗi kết nối mạng' } }
      }
    } catch (err) {
      return { data: null, error: { message: 'Lỗi hệ thống' } }
    }
  },

  /**
   * Sign in with Google
   */
  async signInWithGoogle(options?: { redirectTo?: string }) {
    clearSessionCache()
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    return { data, error }
  },

  /**
   * Sign in with Zalo
   */
  async signInWithZalo(options?: ZaloAuthOptions) {
    clearSessionCache()
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'zalo' as any, 
      options: {
        redirectTo,
        scopes: options?.scopes || 'id,name,picture,phone',
        queryParams: { app_id: process.env.NEXT_PUBLIC_ZALO_APP_ID || '' },
      },
    })
    return { data, error }
  },

  async handleOAuthCallback() {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession())
      return { session: data.session, error }
    } catch (error) {
      return { session: null, error }
    }
  },

  /**
   * Sign Out
   */
  async signOut() {
    clearSessionCache()
    clearDeviceFingerprintCache() 
    deviceService.clearDeviceId()
    
    try {
      const { data: { user } } = await this.getUser()
      if (user) {
        const deviceId = deviceService.getOrCreateDeviceId()
        deviceService.removeDevice(user.id, deviceId).catch(console.error)
      }
      const { error } = await withTimeout(supabase.auth.signOut())
      return { error }
    } catch (err) {
      return { error: err }
    }
  },

  /**
   * Get Session (Safe & Optimized)
   */
  async getSession(forceRefresh = false) {
    try {
      // 1. Dùng Cache nếu không force refresh và cache còn hạn
      if (!forceRefresh && sessionCache && (Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL)) {
        return { session: sessionCache.session, error: null }
      }

      // 2. Fetch mới với Timeout (Tránh treo)
      const { data, error } = await withTimeout(supabase.auth.getSession())

      // 3. Cập nhật Cache
      if (!error && data.session) {
        sessionCache = {
          session: data.session,
          user: data.session.user,
          timestamp: Date.now()
        }
      } else if (!data.session) {
        clearSessionCache()
      }

      return { session: data.session, error }
    } catch (error) {
      console.error("🔥 [AuthService] Session Timeout:", error)
      // Trả về null để UI không bị treo loading
      return { session: null, error }
    }
  },

  /**
   * Get User (Safe & Optimized)
   */
  async getUser(forceRefresh = false) {
    try {
      if (!forceRefresh && sessionCache && (Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL)) {
        return { user: sessionCache.user, error: null }
      }

      const { data, error } = await withTimeout(supabase.auth.getUser())
      
      if (!error && data.user) {
        sessionCache = {
          session: null, 
          user: data.user,
          timestamp: Date.now()
        }
      } else if (error) {
        clearSessionCache()
      }
      return { user: data.user, error }
    } catch (error) {
      return { user: null, error }
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },

  // --- DEVICE MANAGEMENT ---

  async trackUserDevice(userId: string) {
    try {
      const deviceId = deviceService.getOrCreateDeviceId()
      const { error } = await deviceService.enforceDeviceLimit(userId, 3)
      if (error) return { error }

      const { device, error: registerError } = await deviceService.registerDevice(userId, deviceId)
      return { device, error: registerError }
    } catch (err) {
      return { error: err }
    }
  },

  async getUserDevices() {
    const { user } = await this.getUser()
    if (!user) return { devices: null, error: new Error('No user logged in') }
    return await deviceService.getUserDevices(user.id)
  },

  async removeUserDevice(deviceId: string) {
    const { user } = await this.getUser()
    if (!user) return { error: new Error('No user logged in') }
    return await deviceService.removeDevice(user.id, deviceId)
  },

  async updateDeviceActivity() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const deviceId = deviceService.getOrCreateDeviceId()
    await deviceService.updateDeviceActivity(data.user.id, deviceId)
  },
  
  async getUserMetadata() {
    const { user, error } = await this.getUser()
    if (error || !user) return { metadata: null, error }
    return {
      metadata: {
        email: user.email,
        fullName: user.user_metadata?.full_name || user.user_metadata?.name,
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        phoneNumber: user.user_metadata?.phone_number || user.user_metadata?.phone,
        provider: user.app_metadata?.provider,
        providerId: user.user_metadata?.sub || user.user_metadata?.provider_id,
      },
      error: null,
    }
  }
}
