// services/auth.service.ts
import { supabase } from '@/lib/supabaseClient'
import { deviceService } from './device.service' // Giả định bạn có file này
import { clearDeviceFingerprintCache } from '@/lib/session-manager' // Giả định bạn có file này

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

  async signIn({ email, password }: AuthCredentials) {
    clearSessionCache()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (data.user && !error) {
      // Non-blocking device tracking
      this.trackUserDevice(data.user.id).catch(console.error)
    }
    return { data, error }
  },

  // ... (Giữ lại các hàm signInWithPhone, signInWithGoogle, signInWithZalo như cũ, nhớ thêm clearSessionCache đầu hàm) ...

  async signOut() {
    clearSessionCache()
    clearDeviceFingerprintCache() // Nếu có
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Xóa device nếu cần (non-blocking)
        // deviceService.removeDevice(...)
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
          session: null, // getUser ko trả full session
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

  // Dummy implementation nếu chưa có file device.service
  async trackUserDevice(userId: string) { return { error: null } } 
}
