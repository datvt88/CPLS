/**
 * Session Manager - Handles session tracking, device management, and security
 */

import { supabase } from './supabaseClient'

export interface DeviceInfo {
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
}

export interface SessionInfo {
  id: string
  device_name: string
  device_type: string
  browser: string
  os: string
  ip_address: string
  last_activity: string
  created_at: string
  is_current: boolean
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
    const stored = localStorage.getItem('cpls_device_fingerprint')
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
    localStorage.setItem('cpls_device_fingerprint', deviceId)
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
    localStorage.removeItem('cpls_device_fingerprint')
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
 * Enforce session limit per user
 * If limit exceeded, delete oldest inactive sessions
 */
async function enforceSessionLimit(userId: string, maxSessions: number): Promise<void> {
  try {
    // Count current sessions
    const { count } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())

    const sessionCount = count || 0

    if (sessionCount >= maxSessions) {
      // Delete oldest sessions to make room
      const sessionsToDelete = sessionCount - maxSessions + 1

      // Get oldest sessions
      const { data: oldSessions } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_activity', { ascending: true })
        .limit(sessionsToDelete)

      if (oldSessions && oldSessions.length > 0) {
        const idsToDelete = oldSessions.map(s => s.id)

        // Delete them
        const { error } = await supabase
          .from('user_sessions')
          .delete()
          .in('id', idsToDelete)

        if (error) {
          console.error('Error enforcing session limit:', error)
        } else {
          console.log(`✅ Deleted ${idsToDelete.length} old sessions to enforce limit`)
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

    // OPTIMIZATION 2: Enforce session limit (max 15 active sessions per user)
    await enforceSessionLimit(userId, 15)

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
