/**
 * Session Manager - Unified session tracking, device management, and security
 * 
 * This module handles:
 * - Device fingerprinting & identification
 * - Session persistence (30 days)
 * - Multi-device management (max 3 devices)
 * - Device registration & tracking
 */

import { supabase } from './supabaseClient'
import { DEVICE_ID_KEY, DEVICE_FINGERPRINT_KEY, MAX_DEVICES } from '@/lib/auth/constants'
import type { DeviceInfo, SessionInfo } from '@/types/auth'

// Re-export types for convenience
export type { DeviceInfo, SessionInfo }

/** User device record from user_devices table */
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

/**
 * Get device information from user agent
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      name: 'Server',
      type: 'desktop',
      browser: 'Unknown',
      os: 'Unknown'
    }
  }

  const ua = navigator.userAgent

  // Detect device type
  const isMobile = /Mobile|Android|iPhone/i.test(ua)
  const isTablet = /iPad|Android(?!.*Mobile)/i.test(ua)
  const type = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'

  // Detect browser
  let browser = 'Unknown'
  if (ua.includes('Edg')) browser = 'Edge'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera'

  // Detect OS
  let os = 'Unknown'
  if (ua.includes('Win')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

  return {
    name: `${browser} on ${os}`,
    type,
    browser,
    os
  }
}

/**
 * Get client IP address (best effort)
 */
async function getClientIP(): Promise<string> {
  if (typeof window === 'undefined') return 'unknown'

  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(3000) // 3s timeout
    })
    const data = await response.json()
    return data.ip || 'unknown'
  } catch (error) {
    console.warn('Failed to get IP address:', error)
    return 'unknown'
  }
}

// Memory cache for device fingerprint (faster than localStorage)
let cachedFingerprint: string | null = null

/**
 * Generate device fingerprint for persistent device recognition
 * Used to identify same device across sessions
 * Optimized with memory cache to avoid repeated computations
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server-side'
  }

  // Return from memory cache if available (fastest)
  if (cachedFingerprint) {
    return cachedFingerprint
  }

  try {
    // Check if we have a stored fingerprint in localStorage
    const stored = localStorage.getItem(DEVICE_FINGERPRINT_KEY)
    if (stored) {
      cachedFingerprint = stored // Cache in memory
      return stored
    }

    const nav = navigator as any
    const screen = window.screen

    // Collect browser characteristics
    const components = [
      nav.userAgent || '',
      nav.language || '',
      screen.colorDepth || '',
      screen.width || '',
      screen.height || '',
      new Date().getTimezoneOffset() || '',
      nav.hardwareConcurrency || '',
      nav.deviceMemory || '',
      nav.platform || '',
      nav.vendor || '',
      // Add canvas fingerprint
      getCanvasFingerprint(),
    ]

    // Create hash-like string
    const fingerprint = components.join('|')
    let hash = 0

    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    const deviceId = `fp_${Math.abs(hash).toString(36)}`

    // Store in both localStorage and memory cache
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, deviceId)
    cachedFingerprint = deviceId

    return deviceId
  } catch (error) {
    console.error('Error generating fingerprint:', error)
    const fallback = 'fallback_' + Date.now().toString(36)
    cachedFingerprint = fallback
    return fallback
  }
}

/**
 * Clear cached fingerprint (call on logout)
 */
export function clearDeviceFingerprintCache(): void {
  cachedFingerprint = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DEVICE_FINGERPRINT_KEY)
  }
}

/**
 * Generate canvas fingerprint for better device identification
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) return 'no-canvas'

    canvas.width = 200
    canvas.height = 50

    // Draw text with various styles
    ctx.textBaseline = 'top'
    ctx.font = '14px "Arial"'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('CPLS', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Device', 4, 17)

    // Get canvas data
    return canvas.toDataURL().slice(-50) // Last 50 chars
  } catch (error) {
    return 'canvas-error'
  }
}

/**
 * Cleanup expired and inactive sessions for specific user
 */
async function cleanupUserSessions(userId: string): Promise<void> {
  try {
    const now = new Date().toISOString()

    // Delete expired sessions
    const { error: expiredError } = await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', now)

    if (expiredError) {
      console.error('Error cleaning expired sessions:', expiredError)
    }

    // Delete inactive sessions older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { error: inactiveError } = await supabase
      .from('user_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('is_active', false)
      .lt('created_at', thirtyDaysAgo)

    if (inactiveError) {
      console.error('Error cleaning inactive sessions:', inactiveError)
    }
  } catch (error) {
    console.error('Error in cleanupUserSessions:', error)
  }
}

/**
 * Enforce session limit per user (max different devices)
 * Counts unique devices by fingerprint and deletes oldest sessions if limit exceeded
 * This ensures each account can only have sessions from max N different devices
 */
async function enforceSessionLimit(userId: string, maxDevices: number): Promise<void> {
  try {
    // Get all active sessions with their fingerprints
    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('id, fingerprint, last_activity')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .order('last_activity', { ascending: false }) // Newest first

    if (!sessions || sessions.length === 0) {
      return
    }

    // Group sessions by device fingerprint (unique devices)
    const deviceMap = new Map<string, typeof sessions>()

    for (const session of sessions) {
      const fp = session.fingerprint || 'unknown'
      if (!deviceMap.has(fp)) {
        deviceMap.set(fp, [])
      }
      deviceMap.get(fp)!.push(session)
    }

    const uniqueDeviceCount = deviceMap.size

    // If we have more than maxDevices, remove oldest devices
    if (uniqueDeviceCount > maxDevices) {
      // Get the last activity time for each device (most recent session per device)
      const deviceActivity = Array.from(deviceMap.entries()).map(([fp, sessions]) => ({
        fingerprint: fp,
        lastActivity: sessions[0].last_activity, // Already sorted newest first
        sessions: sessions
      }))

      // Sort by last activity (oldest devices first)
      deviceActivity.sort((a, b) =>
        new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
      )

      // Calculate how many devices to remove
      const devicesToRemove = uniqueDeviceCount - maxDevices

      // Get sessions from oldest devices to delete
      const sessionsToDelete: string[] = []
      for (let i = 0; i < devicesToRemove; i++) {
        const device = deviceActivity[i]
        sessionsToDelete.push(...device.sessions.map(s => s.id))
      }

      if (sessionsToDelete.length > 0) {
        const { error } = await supabase
          .from('user_sessions')
          .delete()
          .in('id', sessionsToDelete)

        if (error) {
          console.error('Error enforcing device limit:', error)
        } else {
          console.log(`✅ Deleted ${sessionsToDelete.length} session(s) from ${devicesToRemove} old device(s) to enforce limit of ${maxDevices} devices`)
        }
      }
    }
  } catch (error) {
    console.error('Error in enforceSessionLimit:', error)
  }
}

/**
 * Create session record in database
 * Auto-cleans up expired sessions before creating new one
 */
export async function createSessionRecord(
  userId: string,
  sessionToken: string,
  fingerprint?: string
): Promise<string | null> {
  try {
    const deviceInfo = getDeviceInfo()
    const ipAddress = await getClientIP()

    // Use provided fingerprint or generate new one
    const deviceFingerprint = fingerprint || await getDeviceFingerprint()

    // OPTIMIZATION 1: Auto-cleanup expired/old sessions for this user before creating new one
    await cleanupUserSessions(userId)

    // OPTIMIZATION 2: Delete existing session from same device (1 device = 1 session)
    const { data: existingSessions } = await supabase
      .from('user_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('fingerprint', deviceFingerprint)
      .eq('is_active', true)

    if (existingSessions && existingSessions.length > 0) {
      const idsToDelete = existingSessions.map(s => s.id)
      await supabase
        .from('user_sessions')
        .delete()
        .in('id', idsToDelete)

      console.log(`✅ Replaced ${idsToDelete.length} old session(s) from same device`)
    }

    // OPTIMIZATION 3: Enforce session limit (max 3 different devices per account)
    await enforceSessionLimit(userId, 3)

    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        device_name: deviceInfo.name,
        device_type: deviceInfo.type,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ip_address: ipAddress,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        fingerprint: deviceFingerprint,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create session record:', error)
      return null
    }

    console.log('✅ Session record created:', data.id, '| Fingerprint:', deviceFingerprint.slice(0, 12) + '...')
    return data.id
  } catch (error) {
    console.error('Error in createSessionRecord:', error)
    return null
  }
}

/**
 * Update session last_activity timestamp
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('session_token', sessionToken)
      .eq('is_active', true)

    if (error) {
      console.error('Failed to update session activity:', error)
    }
  } catch (error) {
    console.error('Error in updateSessionActivity:', error)
  }
}

/**
 * Get all active sessions for current user
 */
export async function getActiveSessions(): Promise<SessionInfo[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.warn('No session found when getting active sessions')
      return []
    }

    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString()) // Not expired
      .order('last_activity', { ascending: false })

    if (error) {
      console.error('Failed to get sessions:', error)
      return []
    }

    // Mark current session
    const currentToken = session.access_token

    return data.map(s => ({
      id: s.id,
      device_name: s.device_name || 'Unknown Device',
      device_type: s.device_type || 'desktop',
      browser: s.browser || 'Unknown',
      os: s.os || 'Unknown',
      ip_address: s.ip_address || 'unknown',
      last_activity: s.last_activity,
      created_at: s.created_at,
      is_current: s.session_token === currentToken
    }))
  } catch (error) {
    console.error('Error in getActiveSessions:', error)
    return []
  }
}

/**
 * Revoke specific session (logout from device) - DELETES session
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) {
    console.error('Failed to revoke session:', error)
    throw new Error('Failed to revoke session')
  }

  console.log('✅ Session revoked (deleted):', sessionId)
}

/**
 * Revoke all sessions except current one - DELETES sessions
 */
export async function revokeAllOtherSessions(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('No active session')
  }

  const currentToken = session.access_token

  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', session.user.id)
    .neq('session_token', currentToken)

  if (error) {
    console.error('Failed to revoke other sessions:', error)
    throw new Error('Failed to revoke sessions')
  }

  console.log('✅ All other sessions revoked (deleted)')
}

/**
 * Revoke all sessions for current user (logout everywhere) - DELETES sessions
 */
export async function revokeAllSessions(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('No active session')
  }

  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', session.user.id)

  if (error) {
    console.error('Failed to revoke all sessions:', error)
    throw new Error('Failed to revoke all sessions')
  }

  // Also sign out from Supabase
  await supabase.auth.signOut()

  console.log('✅ All sessions revoked (deleted) and signed out')
}

/**
 * Cleanup expired sessions for current user - DELETES instead of marking inactive
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return 0

  const { error, count } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', session.user.id)
    .lt('expires_at', new Date().toISOString())

  if (error) {
    console.error('Failed to cleanup expired sessions:', error)
    return 0
  }

  console.log(`✅ Cleaned up (deleted) ${count || 0} expired sessions`)
  return count || 0
}

/**
 * Get session statistics for current user
 */
export async function getSessionStats() {
  const sessions = await getActiveSessions()

  const stats = {
    total: sessions.length,
    desktop: sessions.filter(s => s.device_type === 'desktop').length,
    mobile: sessions.filter(s => s.device_type === 'mobile').length,
    tablet: sessions.filter(s => s.device_type === 'tablet').length,
    browsers: [...new Set(sessions.map(s => s.browser))],
    mostRecentActivity: sessions.length > 0 ? sessions[0].last_activity : null
  }

  return stats
}

// ============ DEVICE SERVICE (user_devices table) ============
// Unified device management - replaces services/device.service.ts

/**
 * Device service for managing user devices (user_devices table)
 * This complements the session-based management (user_sessions table)
 */
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
   * Get or create device ID from localStorage
   */
  getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return ''

    let deviceId = localStorage.getItem(DEVICE_ID_KEY)

    if (!deviceId) {
      deviceId = this.generateDeviceId()
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }

    return deviceId
  },

  /**
   * Clear device ID (logout)
   */
  clearDeviceId(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(DEVICE_ID_KEY)
  },

  /**
   * Register or update current device
   */
  async registerDevice(userId: string, deviceId: string) {
    const deviceInfo = getDeviceInfo()

    const { data, error } = await supabase
      .from('user_devices')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        device_name: deviceInfo.name,
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
   * Check device limit and remove oldest if needed (max 3 devices)
   */
  async enforceDeviceLimit(userId: string, maxDevices: number = MAX_DEVICES): Promise<{
    can_add: boolean
    removed_device?: UserDevice
    error?: any
  }> {
    const currentDeviceId = this.getOrCreateDeviceId()

    // 1. Get all devices
    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('device_id')
      .eq('user_id', userId)

    if (error) {
      console.error('Error counting devices:', error)
      return { can_add: false, error }
    }

    const deviceCount = devices?.length || 0
    
    // 2. Check if current device is already registered
    const isCurrentDeviceRegistered = devices?.some(d => d.device_id === currentDeviceId)

    // If device already registered -> Allow update
    if (isCurrentDeviceRegistered) {
      return { can_add: true }
    }

    // 3. If not registered and slots available -> Allow add
    if (deviceCount < maxDevices) {
      return { can_add: true }
    }

    // 4. If slots full -> Remove oldest device
    const { removed_device, error: removeError } = await this.removeOldestDevice(userId)

    if (removeError) {
      return { can_add: false, error: removeError }
    }

    return {
      can_add: true,
      removed_device: removed_device as UserDevice
    }
  }
}
