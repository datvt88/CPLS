import { supabase } from '@/lib/supabaseClient'

export interface UserDevice {
  id: string
  user_id: string
  device_id: string
  device_name?: string
  browser?: string
  os?: string
  ip_address?: string
  last_active_at: string
  created_at: string
}

export const deviceService = {
  /**
   * Generate a unique device ID based on browser fingerprint
   */
  generateDeviceId(): string {
    const nav = navigator as any
    const screen = window.screen

    const fingerprint = [
      nav.userAgent,
      nav.language,
      screen.colorDepth,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
      nav.hardwareConcurrency || 'unknown',
      nav.deviceMemory || 'unknown',
    ].join('|')

    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    return `device_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`
  },

  /**
   * Get device info from browser
   */
  getDeviceInfo(): { device_name: string; browser: string; os: string } {
    const ua = navigator.userAgent
    let browser = 'Unknown'
    if (ua.indexOf('Firefox') > -1) browser = 'Firefox'
    else if (ua.indexOf('Chrome') > -1) browser = 'Chrome'
    else if (ua.indexOf('Safari') > -1) browser = 'Safari'
    else if (ua.indexOf('Edge') > -1) browser = 'Edge'
    else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera'

    let os = 'Unknown'
    if (ua.indexOf('Win') > -1) os = 'Windows'
    else if (ua.indexOf('Mac') > -1) os = 'macOS'
    else if (ua.indexOf('Linux') > -1) os = 'Linux'
    else if (ua.indexOf('Android') > -1) os = 'Android'
    else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS'

    const device_name = `${browser} on ${os}`
    return { device_name, browser, os }
  },

  /**
   * Register or update current device
   */
  async registerDevice(userId: string, deviceId: string) {
    const deviceInfo = this.getDeviceInfo()

    const { data, error } = await supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceInfo.device_name,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        last_active_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,device_id'
      })
      .select()
      .single()

    return { device: data as UserDevice | null, error }
  },

  /**
   * Update device last active time
   */
  async updateDeviceActivity(userId: string, deviceId: string) {
    const { error } = await supabase
      .from('user_devices')
      .update({ last_active_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('device_id', deviceId)

    return { error }
  },

  /**
   * Get all active devices for a user
   */
  async getUserDevices(userId: string) {
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_active_at', { ascending: false })

    return { devices: data as UserDevice[] | null, error }
  },

  /**
   * Remove a specific device
   */
  async removeDevice(userId: string, deviceId: string) {
    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('user_id', userId)
      .eq('device_id', deviceId)

    return { error }
  },

  /**
   * Remove oldest device (by last_active_at)
   */
  async removeOldestDevice(userId: string) {
    const { data: devices, error: fetchError } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .order('last_active_at', { ascending: true })
      .limit(1)

    if (fetchError || !devices || devices.length === 0) {
      return { error: fetchError || new Error('No devices found') }
    }

    const oldestDevice = devices[0]

    const { error: deleteError } = await supabase
      .from('user_devices')
      .delete()
      .eq('id', oldestDevice.id)

    return {
      removed_device: oldestDevice as UserDevice,
      error: deleteError
    }
  },

  /**
   * Check if device limit is reached (max 3 devices)
   * ✨ TỐI ƯU HÓA: Kiểm tra xem thiết bị hiện tại đã tồn tại chưa trước khi xóa
   */
  async enforceDeviceLimit(userId: string, maxDevices: number = 3): Promise<{
    can_add: boolean
    removed_device?: UserDevice
    error?: any
  }> {
    const currentDeviceId = this.getOrCreateDeviceId()

    // 1. Lấy danh sách tất cả thiết bị
    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('device_id')
      .eq('user_id', userId)

    if (error) {
      console.error('Error counting devices:', error)
      return { can_add: false, error }
    }

    const deviceCount = devices?.length || 0
    
    // 2. Kiểm tra xem thiết bị hiện tại có trong danh sách không
    const isCurrentDeviceRegistered = devices?.some(d => d.device_id === currentDeviceId)

    // Nếu thiết bị đã đăng ký -> Cho phép update (không tính là thêm mới)
    if (isCurrentDeviceRegistered) {
        return { can_add: true }
    }

    // 3. Nếu chưa đăng ký và chưa đầy slot -> Cho phép thêm
    if (deviceCount < maxDevices) {
      return { can_add: true }
    }

    // 4. Nếu đầy slot -> Xóa thiết bị cũ nhất để nhường chỗ
    const { removed_device, error: removeError } = await this.removeOldestDevice(userId)

    if (removeError) {
      return { can_add: false, error: removeError }
    }

    return {
      can_add: true,
      removed_device: removed_device as UserDevice
    }
  },

  /**
   * Get or create device ID from localStorage
   */
  getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return ''

    const storageKey = 'cpls-device-id'
    let deviceId = localStorage.getItem(storageKey)

    if (!deviceId) {
      deviceId = this.generateDeviceId()
      localStorage.setItem(storageKey, deviceId)
    }

    return deviceId
  },

  /**
   * Clear device ID (logout)
   */
  clearDeviceId(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('cpls-device-id')
  }
}
