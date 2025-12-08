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

// Helper: Timeout Wrapper
const withTimeout = <T>(promise: Promise<T>, ms: number = 7000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ]);
}

export const authService = {
  // ... (Giữ nguyên các hàm signUp, signIn, signInWithPhone, signInWithGoogle, signInWithZalo...)
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

  // ... (Các hàm SignIn khác giữ nguyên) ...

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

  // 👇 Rút gọn tối đa: Không cache thủ công, chỉ gọi API với Timeout
  async getSession() {
    try {
      const { data, error } = await withTimeout(supabase.auth.getSession())
      return { session: data.session, error }
    } catch (error) {
      console.error("🔥 [AuthService] Session Error:", error)
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

  // ... (Giữ nguyên các hàm device: trackUserDevice, updateDeviceActivity, getUserDevices, removeUserDevice)
  async trackUserDevice(userId: string) {
    try {
      const deviceId = deviceService.getOrCreateDeviceId()
      const { error } = await deviceService.enforceDeviceLimit(userId, 3)
      if (error) return { error }
      const { device, error: registerError } = await deviceService.registerDevice(userId, deviceId)
      return { device, error: registerError }
    } catch (err) { return { error: err } }
  },
  
  async updateDeviceActivity() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const deviceId = deviceService.getOrCreateDeviceId()
    await deviceService.updateDeviceActivity(data.user.id, deviceId)
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
  }
}
