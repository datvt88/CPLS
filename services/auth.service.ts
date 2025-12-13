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
const OAUTH_TIMEOUT = 15000 // 15 seconds for OAuth operations

// ============================================================================
// Helpers
// ============================================================================

/**
 * Wraps a promise with a timeout
 * Following Google's best practice for network request timeouts
 */
const withTimeout = <T>(promise: Promise<T>, ms: number = AUTH_TIMEOUT): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ])
}

/**
 * Get the OAuth callback URL
 */
const getCallbackUrl = (): string => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  return 'http://localhost:3000/auth/callback'
}

// ============================================================================
// Auth Service
// Following Google's authentication system best practices:
// - PKCE flow for OAuth
// - Proper timeout handling
// - Clean error handling
// - Device tracking for security
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
   * Sign in with phone number (looks up email, then authenticates)
   */
  async signInWithPhone({ phoneNumber, password }: PhoneCredentials) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT)

      try {
        // Look up email by phone number
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

        // Authenticate with email and password
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
   * Sign in with Google OAuth
   * Following Google's OAuth 2.0 best practices with PKCE flow
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
            scope: 'openid email profile',
          },
          skipBrowserRedirect: false,
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
   * Handle OAuth callback - exchange code for session
   */
  async handleOAuthCallback(): Promise<SessionResult> {
    try {
      if (typeof window === 'undefined') {
        return { session: null, error: null }
      }

      const url = new URL(window.location.href)
      // Check for code in both query params and hash fragment
      const code = url.searchParams.get('code') || new URLSearchParams(url.hash.slice(1)).get('code')
      
      // Exchange authorization code for session (PKCE flow)
      if (code) {
        const { data, error } = await withTimeout(
          supabase.auth.exchangeCodeForSession(code),
          OAUTH_TIMEOUT
        )
        
        if (error) {
          // Handle code already used (e.g., page refresh)
          if (error.message.includes('already used') || error.message.includes('invalid')) {
            const { data: existingSession } = await withTimeout(
              supabase.auth.getSession(),
              OAUTH_TIMEOUT
            )
            if (existingSession.session?.user) {
              this.trackUserDevice(existingSession.session.user.id).catch(console.error)
              return { session: existingSession.session, error: null }
            }
          }
          return { session: null, error }
        }
        
        if (data?.session?.user) {
          this.trackUserDevice(data.session.user.id).catch(console.error)
          return { session: data.session, error: null }
        }
      }
      
      // Fallback: check for existing session
      const { data, error } = await withTimeout(supabase.auth.getSession())
      
      if (error) {
        return { session: null, error }
      }
      
      if (data.session?.user) {
        this.trackUserDevice(data.session.user.id).catch(console.error)
      }
      
      return { session: data.session, error: null }
    } catch (error) {
      console.error('[Auth] OAuth callback exception:', error)
      return { session: null, error: error as AuthError }
    }
  },

  /**
   * Sign out the current user
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
   * Get the current session
   */
  async getSession(): Promise<SessionResult> {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession())
      if (error) {
        console.error('[Auth] Session error:', error)
        return { session: null, error }
      }
      return { session: data.session, error: null }
    } catch (error) {
      console.error('[Auth] Session timeout:', error)
      return { session: null, error: error as AuthError }
    }
  },

  /**
   * Get the current user
   */
  async getUser(): Promise<UserResult> {
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser())
      return { user: data.user, error }
    } catch (error) {
      return { user: null, error: error as AuthError }
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },

  /**
   * Get user metadata (email, name, avatar, etc.)
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
  // Device Management
  // ============================================================================

  /**
   * Track user device for security
   */
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

  /**
   * Get all devices for the current user
   */
  async getUserDevices() {
    const { user } = await this.getUser()
    if (!user) return { devices: null, error: new Error('No user logged in') }
    return await deviceService.getUserDevices(user.id)
  },

  /**
   * Remove a device for the current user
   */
  async removeUserDevice(deviceId: string) {
    const { user } = await this.getUser()
    if (!user) return { error: new Error('No user logged in') }
    return await deviceService.removeDevice(user.id, deviceId)
  },

  /**
   * Update device activity timestamp
   */
  async updateDeviceActivity() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const deviceId = deviceService.getOrCreateDeviceId()
    await deviceService.updateDeviceActivity(data.user.id, deviceId)
  }
}
