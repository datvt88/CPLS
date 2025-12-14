import { supabase } from '@/lib/supabaseClient'
import { AUTH_TIMEOUT, OAUTH_TIMEOUT } from '@/lib/auth/constants'
import { getCallbackUrl, withTimeout } from '@/lib/auth/helpers'
import type { 
  EmailCredentials, 
  PhoneCredentials, 
  OAuthOptions,
  SessionResult, 
  UserResult 
} from '@/types/auth'
import type { AuthError, Session } from '@supabase/supabase-js'

// Alias for backward compatibility
type AuthCredentials = EmailCredentials

// Re-export types for convenience
export type { EmailCredentials, PhoneCredentials, OAuthOptions, SessionResult, UserResult }

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
   */
  async signInWithGoogle(options?: OAuthOptions) {
    try {
      const redirectTo = options?.redirectTo || getCallbackUrl()
      
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
    try {
      const { error } = await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT)
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
      const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT)
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
      const { data, error } = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT)
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
