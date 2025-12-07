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
      // Non-blocking device tracking
      this.trackUserDevice(data.user.id).catch(console.error)
    }
    return { data, error }
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
   * Đăng xuất an toàn
   */
  async signOut() {
    clearSessionCache()
    clearDeviceFingerprintCache() 
    deviceService.clearDeviceId()
    
    try {
      // Lấy user hiện tại để xóa device (nếu cần)
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

  // --- CÁC HÀM DEVICE MANAGEMENT (Bổ sung để sửa lỗi) ---

  async trackUserDevice(userId: string) {
    try {
      const deviceId = deviceService.getOrCreateDeviceId()
      const { can_add, removed_device, error } = await deviceService.enforceDeviceLimit(userId, 3)

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
