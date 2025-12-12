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

// Default timeout for auth operations
const AUTH_TIMEOUT = 10000 // 10 seconds

// Timeout helper
const withTimeout = <T>(promise: Promise<T>, ms: number = AUTH_TIMEOUT): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ]);
}

export const authService = {
  async signUp({ email, password }: AuthCredentials) {
    const redirectUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback'
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: redirectUrl }
    })
    return { data, error }
  },

  async signIn({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (data.user && !error) {
      this.trackUserDevice(data.user.id).catch(console.error)
    }
    return { data, error }
  },

  async signInWithPhone({ phoneNumber, password }: { phoneNumber: string; password: string }) {
    try {
      console.log('🔐 [Auth] Starting phone login:', phoneNumber)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch('/api/auth/signin-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const data = await response.json()

        if (!response.ok) return { data: null, error: { message: data.error || 'Số điện thoại không tồn tại' } }

        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: data.email, password: password,
        })

        if (error) return { data: authData, error: { message: 'Mật khẩu không đúng' } }
        if (authData.user) this.trackUserDevice(authData.user.id).catch(console.error)

        return { data: authData, error: null }
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        return { data: null, error: { message: 'Lỗi kết nối mạng' } }
      }
    } catch (err) {
      return { data: null, error: { message: 'Lỗi hệ thống' } }
    }
  },

  async signInWithGoogle(options?: { redirectTo?: string }) {
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    return { data, error }
  },

  async signInWithZalo(options?: ZaloAuthOptions) {
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'zalo' as any, 
      options: {
        redirectTo,
        scopes: options?.scopes || 'id,name,picture,phone',
        queryParams: { app_id: process.env.NEXT_PUBLIC_ZALO_APP_ID || '' },
      },
    })
    return { data, error }
  },

  async handleOAuthCallback() {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession())
      return { session: data.session, error }
    } catch (error) {
      return { session: null, error }
    }
  },

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

  async getSession() {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession())
      if (error) {
        console.error("🔥 [AuthService] Session Error:", error)
        return { session: null, error }
      }
      return { session: data.session, error: null }
    } catch (error) {
      console.error("🔥 [AuthService] Session Timeout:", error)
      return { session: null, error }
    }
  },

  async getUser() {
    try {
      const { data, error } = await withTimeout(supabase.auth.getUser())
      return { user: data.user, error }
    } catch (error) {
      return { user: null, error }
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },

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

  // --- DEVICE MANAGEMENT ---
  async trackUserDevice(userId: string) {
    try {
      const deviceId = deviceService.getOrCreateDeviceId()
      const { error } = await deviceService.enforceDeviceLimit(userId, 3)
      if (error) return { error }
      const { device, error: registerError } = await deviceService.registerDevice(userId, deviceId)
      return { device, error: registerError }
    } catch (err) { return { error: err } }
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
