import { supabase } from '@/lib/supabaseClient'
import { deviceService, clearDeviceFingerprintCache } from '@/lib/session-manager'
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
    if (data.user && !error) {
      this.trackUserDevice(data.user.id).catch(console.error)
    }
    return { data, error }
  },

  /**
   * Sign in with Google OAuth
   * QUAN TRỌNG: Đã sửa redirectTo để trỏ chính xác về Server Route
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
          // skipBrowserRedirect: false là mặc định, không cần ghi cũng được
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
      // (Giữ nguyên logic cũ của bạn)
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
        
        if (authData.user) {
          this.trackUserDevice(authData.user.id).catch(console.error)
        }

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
   * LƯU Ý: Vì chúng ta dùng Server-Side Auth (route.ts), Client không cần exchange code nữa.
   * Hàm này chỉ đơn giản là đợi session được đồng bộ xuống client.
   */
  async handleOAuthCallback(): Promise<SessionResult> {
    try {
      if (typeof window === 'undefined') {
        return { session: null, error: null }
      }

      // Chỉ cần getSession() để check xem Server đã set cookie thành công chưa
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        OAUTH_TIMEOUT
      )
      
      if (data.session?.user) {
        this.trackUserDevice(data.session.user.id).catch(console.error)
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
    clearDeviceFingerprintCache()
    deviceService.clearDeviceId()
    try {
      const { data: { user } } = await supabase.auth.getUser()
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
   * Get current session
   */
  async getSession(): Promise<SessionResult> {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession())
      if (error) {
        // Silent error log
        // console.error('[Auth] Session error:', error)
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

  // (Giữ nguyên các hàm trackUserDevice, getUserDevices...)
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

  async trackUserDevice(userId: string) {
    try {
      const deviceId = deviceService.getOrCreateDeviceId()
      // Skip error check for limit enforcement to allow login
      await deviceService.enforceDeviceLimit(userId, 3).catch(() => {})
      
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
