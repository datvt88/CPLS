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

// Cache session để tránh spam request
let sessionCache: {
  session: any | null
  user: any | null
  timestamp: number
} | null = null

const SESSION_CACHE_TTL = 60 * 1000 // 1 phút

function clearSessionCache() {
  sessionCache = null
}

// Listener: Cập nhật cache khi trạng thái auth thay đổi
if (typeof window !== 'undefined') {
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
}

export const authService = {
  /**
   * Đăng ký
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
   * Đăng nhập Email/Password
   */
  async signIn({ email, password }: AuthCredentials) {
    clearSessionCache()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (data.user && !error) {
      this.trackUserDevice(data.user.id).catch(console.error)
    }
    return { data, error }
  },

  /**
   * Đăng nhập bằng SỐ ĐIỆN THOẠI (Logic chuyển đổi Phone -> Email)
   */
  async signInWithPhone({ phoneNumber, password }: { phoneNumber: string; password: string }) {
    try {
      console.log('🔐 [Auth] Starting phone login for:', phoneNumber)
      clearSessionCache()

      // 1. Lookup email từ số điện thoại qua API
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

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
          console.error('❌ [Auth] Phone lookup failed:', data.error)
          return { data: null, error: { message: data.error || 'Số điện thoại không tồn tại' } }
        }

        console.log('✅ [Auth] Phone lookup successful, email:', data.email)

        // 2. Đăng nhập Supabase bằng Email tìm được
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: password,
        })

        if (error) {
          console.error('❌ [Auth] Password verification failed:', error.message)
          return { data: authData, error: { message: 'Số điện thoại hoặc mật khẩu không đúng' } }
        }

        // 3. Track device
        if (authData.user) {
          this.trackUserDevice(authData.user.id).catch(console.error)
        }

        return { data: authData, error: null }

      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          return { data: null, error: { message: 'Hết thời gian chờ. Kiểm tra kết nối mạng.' } }
        }
        throw fetchErr
      }
    } catch (err) {
      console.error('❌ [Auth] Unexpected error:', err)
      return { data: null, error: { message: 'Đã có lỗi xảy ra khi đăng nhập.' } }
    }
  },

  /**
   * Đăng nhập Google
   */
  async signInWithGoogle(options?: { redirectTo?: string }) {
    clearSessionCache()
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    return { data, error }
  },

  /**
   * Đăng nhập Zalo
   */
  async signInWithZalo(options?: ZaloAuthOptions) {
    clearSessionCache()
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`
    const scopes = options?.scopes || 'id,name,picture,phone'

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'zalo' as any, 
      options: {
        redirectTo,
        scopes,
        queryParams: {
          app_id: process.env.NEXT_PUBLIC_ZALO_APP_ID || '',
        },
      },
    })
    return { data, error }
  },

  /**
   * Xử lý OAuth Callback
   */
  async handleOAuthCallback() {
    const { data, error } = await supabase.auth.getSession()
    return { session: data.session, error }
  },

  /**
   * Đăng xuất an toàn
   */
  async signOut() {
    clearSessionCache()
    clearDeviceFingerprintCache() 
    deviceService.clearDeviceId()
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const deviceId = deviceService.getOrCreateDeviceId()
        deviceService.removeDevice(user.id, deviceId).catch(console.error)
      }
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (err) {
      return { error: err }
    }
  },

  /**
   * Lấy Session an toàn (Không bao giờ throw error)
   */
  async getSession() {
    try {
      if (sessionCache && (Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL)) {
        return { session: sessionCache.session, error: null }
      }

      const { data, error } = await supabase.auth.getSession()

      if (!error && data.session) {
        sessionCache = {
          session: data.session,
          user: data.session.user,
          timestamp: Date.now()
        }
      }
      return { session: data.session, error }
    } catch (error) {
      console.error("🔥 [AuthService] Session Error:", error)
      return { session: null, error }
    }
  },

  /**
   * Lấy User an toàn
   */
  async getUser() {
    try {
      if (sessionCache && (Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL)) {
        return { user: sessionCache.user, error: null }
      }

      const { data, error } = await supabase.auth.getUser()
      
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
      console.error("🔥 [AuthService] User Error:", error)
      return { user: null, error }
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },

  // --- CÁC HÀM DEVICE MANAGEMENT ---

  async trackUserDevice(userId: string) {
    try {
      const deviceId = deviceService.getOrCreateDeviceId()
      const { error } = await deviceService.enforceDeviceLimit(userId, 3) // Check limit but ignore removed device return

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
  }
}
