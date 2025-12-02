import { supabase } from '@/lib/supabaseClient'
import { deviceService } from './device.service'
import { clearPermissionsCache } from '@/lib/permissions'

export interface AuthCredentials {
  email: string
  password: string
}

export interface ZaloAuthOptions {
  redirectTo?: string
  scopes?: string
}

// Session cache to reduce redundant API calls
let sessionCache: { session: any; timestamp: number } | null = null
const SESSION_CACHE_TTL = 60000 // 1 minute cache

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
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          email_confirmed: false,
        }
      }
    })
    return { data, error }
  },

  /**
   * Sign in with email and password
   */
  async signIn({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    // Clear caches on new login
    sessionCache = null
    clearPermissionsCache()

    // Track device after successful login (with error handling)
    if (data.user && !error) {
      try {
        await this.trackUserDevice(data.user.id)
      } catch (deviceError) {
        console.error('Device tracking failed:', deviceError)
        // Don't fail login if device tracking fails
      }
    }

    return { data, error }
  },

  /**
   * Sign in with phone number and password
   * Converts phone number to email, then authenticates with Supabase
   */
  async signInWithPhone({ phoneNumber, password }: { phoneNumber: string; password: string }) {
    try {
      // Lookup email by phone number
      const response = await fetch('/api/auth/signin-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { data: null, error: { message: data.error || 'Số điện thoại không tồn tại' } }
      }

      // Sign in with the retrieved email
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: password,
      })

      // Clear caches on new login
      sessionCache = null
      clearPermissionsCache()

      // Track device after successful login (with error handling)
      if (authData.user && !error) {
        try {
          await this.trackUserDevice(authData.user.id)
        } catch (deviceError) {
          console.error('Device tracking failed:', deviceError)
          // Don't fail login if device tracking fails
        }
      }

      return { data: authData, error }
    } catch (err) {
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
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`
    const scopes = options?.scopes || 'id,name,picture,phone'

    // Using Supabase OAuth with custom provider
    // Note: This requires configuring a custom OAuth provider in Supabase
    // or using Supabase's third-party provider support
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
    // Supabase automatically handles the OAuth callback
    // Just get the session which should be available after redirect
    const { data, error } = await supabase.auth.getSession()
    return { session: data.session, error }
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    // Get current user before signing out
    const { user } = await this.getUser()

    const { error } = await supabase.auth.signOut()

    // Clear all caches on logout
    sessionCache = null
    clearPermissionsCache()

    // Clear device tracking after logout (with error handling)
    if (user && !error) {
      try {
        const deviceId = deviceService.getOrCreateDeviceId()
        await deviceService.removeDevice(user.id, deviceId)
        deviceService.clearDeviceId()
      } catch (deviceError) {
        console.error('Device cleanup failed:', deviceError)
        // Don't fail logout if device cleanup fails
      }
    }

    return { error }
  },

  /**
   * Get current session (with caching)
   */
  async getSession(useCache = true) {
    // Check cache first
    if (useCache && sessionCache) {
      const now = Date.now()
      if (now - sessionCache.timestamp < SESSION_CACHE_TTL) {
        return { session: sessionCache.session, error: null }
      }
    }

    // Fetch fresh session
    const { data, error } = await supabase.auth.getSession()

    // Update cache on success
    if (!error && data.session) {
      sessionCache = {
        session: data.session,
        timestamp: Date.now()
      }
    }

    return { session: data.session, error }
  },

  /**
   * Get current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser()
    return { user: data.user, error }
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
    const { user } = await this.getUser()
    if (!user) return

    const deviceId = deviceService.getOrCreateDeviceId()
    await deviceService.updateDeviceActivity(user.id, deviceId)
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
