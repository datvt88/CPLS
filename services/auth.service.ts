import { supabase } from '@/lib/supabaseClient'
import type { AuthError, Session, User } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

export interface AuthCredentials {
  email: string
  password: string
}

export interface PhoneCredentials {
  phoneNumber: string
  password: string
}

export interface OAuthOptions {
  redirectTo?: string
}

export interface AuthResult<T = void> {
  data: T | null
  error: AuthError | { message: string } | null
}

export interface SessionResult {
  session: Session | null
  error: AuthError | { message: string } | null
}

export interface UserResult {
  user: User | null
  error: AuthError | { message: string } | null
}

// ============================================================================
// Constants
// ============================================================================

const AUTH_TIMEOUT = 10000 // 10 seconds
const OAUTH_TIMEOUT = 15000 // 15 seconds

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the OAuth callback URL
 * QUAN TRỌNG: Luôn trỏ về /auth/callback để Route Handler (route.ts) xử lý
 */
const getCallbackUrl = (): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  return ''
}

/**
 * Wraps a promise with a timeout
 */
const withTimeout = <T>(promise: Promise<T>, ms: number = AUTH_TIMEOUT): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ])
}

// ============================================================================
// Auth Service
// ============================================================================

export const authService = {
  /**
   * Sign up with email and password
   */
  async signUp({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getCallbackUrl() }
    })
    return { data, error }
  },

  /**
   * Sign in with email and password
   */
  async signIn({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    // Đã xóa logic trackUserDevice để tránh lỗi thiếu bảng
    return { data, error }
  },

  /**
   * Sign in with Google OAuth
   * Logic chuẩn: Trỏ về Server Route
   */
  async signInWithGoogle(options?: OAuthOptions) {
    try {
      // Luôn lấy dynamic origin để tránh lỗi mismatch giữa localhost và 127.0.0.1
      const redirectTo = `${window.location.origin}/auth/callback`
      
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
      
      if (error) {
        console.error('[Auth] Google OAuth error:', error.message)
        return { data: null, error }
      }
      
      return { data, error: null }
    } catch (err) {
      console.error('[Auth] Google OAuth exception:', err)
      return { 
        data: null, 
        error: { message: err instanceof Error ? err.message : 'Lỗi không xác định' }
      }
    }
  },

  /**
   * Sign in with phone number
   */
  async signInWithPhone({ phoneNumber, password }: PhoneCredentials) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT)

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
          password,
        })

        if (error) {
          return { data: authData, error: { message: 'Mật khẩu không đúng' } }
        }
        
        // Đã xóa logic trackUserDevice

        return { data: authData, error: null }
      } catch {
        clearTimeout(timeoutId)
        return { data: null, error: { message: 'Lỗi kết nối mạng' } }
      }
    } catch {
      return { data: null, error: { message: 'Lỗi hệ thống' } }
    }
  },

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(): Promise<SessionResult> {
    try {
      if (typeof window === 'undefined') {
        return { session: null, error: null }
      }

      // Check xem Server đã set cookie thành công chưa
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        OAUTH_TIMEOUT
      )
      
      if (data.session?.user) {
        // Đã xóa logic trackUserDevice
        return { session: data.session, error: null }
      }
      
      return { session: null, error: null }
    } catch (error) {
      console.error('[Auth] OAuth callback check error:', error)
      return { session: null, error: error as AuthError }
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    // Đã xóa logic clear device cache
    try {
      const { error } = await withTimeout(supabase.auth.signOut())
      return { error }
    } catch (err) {
      return { error: err }
    }
  },

  /**
   * Get current session
   */
  async getSession(): Promise<SessionResult> {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession())
      if (error) {
        return { session: null, error }
      }
      return { session: data.session, error: null }
    } catch (error) {
      return { session: null, error: error as AuthError }
    }
  },

  /**
   * Get current user
   */
  async getUser(): Promise<UserResult> {
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser())
      return { user: data.user, error }
    } catch (error) {
      return { user: null, error: error as AuthError }
    }
  },

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },

  /**
   * Get user metadata
   */
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
  },

  // ============================================================================
  // Device Management (STUBS)
  // Các hàm này được giữ lại nhưng không làm gì cả để tránh lỗi code ở nơi khác
  // ============================================================================

  async trackUserDevice(userId: string) {
    // Bypass: Không làm gì cả vì không có bảng user_devices
    return { device: null, error: null }
  },

  async getUserDevices() {
    return { devices: [], error: null }
  },

  async removeUserDevice(deviceId: string) {
    return { error: null }
  },

  async updateDeviceActivity() {
    return
  }
}
