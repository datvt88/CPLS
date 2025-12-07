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

const SESSION_CACHE_TTL = 60 * 1000 // 1 minute cache

// Clear cache helper
function clearSessionCache() {
  sessionCache = null
}

// Initialize auth state listener (runs once)
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
   * Sign up a new user with email and password
   * Includes email verification redirect
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
   * Sign in with email and password
   */
  async signIn({ email, password }: AuthCredentials) {
    clearSessionCache() // Clear cache before login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    // Track device after successful login (non-blocking)
    if (data.user && !error) {
      this.trackUserDevice(data.user.id).catch(err => {
        console.error('⚠️ Device tracking failed (non-critical):', err)
      })
    }

    return { data, error }
  },

  /**
   * Sign in with phone number and password
   * Converts phone number to email, then authenticates with Supabase
   */
  async signInWithPhone({ phoneNumber, password }: { phoneNumber: string; password: string }) {
    try {
      console.log('🔐 [Auth] Starting phone login for:', phoneNumber)
      clearSessionCache() // Clear cache before login

      // Lookup email by phone number with timeout
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

        // Sign in with the retrieved email
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: password,
        })

        if (error) {
          console.error('❌ [Auth] Password verification failed:', error.message)
          return { data: authData, error: { message: 'Số điện thoại hoặc mật khẩu không đúng' } }
        }

        console.log('✅ [Auth] Login successful for user:', authData.user?.id)

        // Track device after successful login (non-blocking)
        if (authData.user) {
          this.trackUserDevice(authData.user.id).catch(err => {
            console.error('⚠️ Device tracking failed (non-critical):', err)
          })
        }

        return { data: authData, error: null }
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          console.error('❌ [Auth] Request timeout')
          return {
            data: null,
            error: { message: 'Yêu cầu hết thời gian chờ. Vui lòng kiểm tra kết nối mạng.' }
          }
        }
        throw fetchErr
      }
    } catch (err) {
      console.error('❌ [Auth] Unexpected error:', err)
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra' }
      }
    }
  },

  /**
   * Sign in with Google OAuth
   * Uses Supabase's built-in Google OAuth provider
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
   * Sign in with Zalo OAuth
   * Requires Zalo OAuth to be configured in Supabase
   */
  async signInWithZalo(options?: ZaloAuthOptions) {
    clearSessionCache()
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`
    const scopes = options?.scopes || 'id,name,picture,phone'

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'zalo' as any, // Custom provider
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
   * Handle OAuth callback
   * This should be called in the callback page after OAuth redirect
   */
  async handleOAuthCallback() {
    const { data, error } = await supabase.auth.getSession()
    return { session: data.session, error }
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    // Clear caches immediately for responsive UI
    clearSessionCache()
    clearDeviceFingerprintCache()
    deviceService.clearDeviceId()

    try {
      // Get current user before signing out (to remove device from DB)
      // Note: We use supabase.auth directly to avoid cache interactions here if needed, 
      // but getUser() with cache check is fine as we want the ID.
      // However, to be safe and get fresh state before logout:
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const deviceId = deviceService.getOrCreateDeviceId()
        // Non-blocking device removal
        deviceService.removeDevice(user.id, deviceId).catch(console.error)
      }

      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (err) {
      console.error("Error during sign out:", err)
      return { error: err }
    }
  },

  /**
   * Get current session (with caching)
   */
  async getSession() {
    try {
      // Check cache first
      if (sessionCache && (Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL)) {
        // console.log('✨ [Auth] Using cached session') // Optional logging
        return { session: sessionCache.session, error: null }
      }

      // Cache miss or expired - fetch fresh
      // console.log('🔄 [Auth] Fetching fresh session') // Optional logging
      const { data, error } = await supabase.auth.getSession()

      // Update cache
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
   * Get current user (with caching)
   */
  async getUser() {
    try {
      // Check cache first
      if (sessionCache && (Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL)) {
        // console.log('✨ [Auth] Using cached user') // Optional logging
        return { user: sessionCache.user, error: null }
      }

      // Cache miss or expired - fetch fresh
      // console.log('🔄 [Auth] Fetching fresh user') // Optional logging
      const { data, error } = await supabase.auth.getUser()

      // Update cache
      if (!error && data.user) {
        sessionCache = {
          session: null, // We don't have full session from getUser
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

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },

  /**
   * Get user metadata (includes OAuth provider data)
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

  /**
   * Track user device (max 3 devices)
   * Automatically removes oldest device if limit is reached
   */
  async trackUserDevice(userId: string) {
    try {
      const deviceId = deviceService.getOrCreateDeviceId()

      // Enforce device limit (max 3)
      const { can_add, removed_device, error } = await deviceService.enforceDeviceLimit(userId, 3)

      if (error) {
        console.error('Error enforcing device limit:', error)
        return { error }
      }

      if (removed_device) {
        console.log('⚠️ Device limit reached. Removed oldest device:', removed_device.device_name)
      }

      // Register current device
      const { device, error: registerError } = await deviceService.registerDevice(userId, deviceId)

      if (registerError) {
        console.error('Error registering device:', registerError)
        return { error: registerError }
      }

      console.log('✅ Device tracked:', device?.device_name)
      return { device, removed_device }
    } catch (err) {
      console.error('Error tracking device:', err)
      return { error: err }
    }
  },

  /**
   * Update device activity (call periodically to keep device active)
   */
  async updateDeviceActivity() {
    // Avoid using this.getUser() here to prevent potential recursive loops or unnecessary cache checks if called frequently
    // Direct call is safer for background activity updates
    const { data } = await supabase.auth.getUser()
    if (!data.user) return

    const deviceId = deviceService.getOrCreateDeviceId()
    await deviceService.updateDeviceActivity(data.user.id, deviceId)
  },

  /**
   * Get user's active devices
   */
  async getUserDevices() {
    const { user } = await this.getUser()
    if (!user) return { devices: null, error: new Error('No user logged in') }

    return await deviceService.getUserDevices(user.id)
  },

  /**
   * Remove a specific device (logout from another device)
   */
  async removeUserDevice(deviceId: string) {
    const { user } = await this.getUser()
    if (!user) return { error: new Error('No user logged in') }

    return await deviceService.removeDevice(user.id, deviceId)
  },
}
