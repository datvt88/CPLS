import { supabase } from '@/lib/supabaseClient'
import { deviceService } from './device.service'

export interface AuthCredentials {
  email: string
  password: string
}

export interface ZaloAuthOptions {
  redirectTo?: string
  scopes?: string
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

    // Clear device tracking after logout
    if (user && !error) {
      const deviceId = deviceService.getOrCreateDeviceId()
      await deviceService.removeDevice(user.id, deviceId)
      deviceService.clearDeviceId()
    }

    return { error }
  },

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
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
