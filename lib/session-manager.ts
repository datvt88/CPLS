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

/**
 * Generate device fingerprint for persistent device recognition
 * Used to identify same device across sessions
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') {
    return 'server-side'
  }

  try {
    // Check if we have a stored fingerprint
    const stored = localStorage.getItem('cpls_device_fingerprint')
    if (stored) {
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

    // Store in localStorage for consistency
    localStorage.setItem('cpls_device_fingerprint', deviceId)
    return deviceId
  } catch (error) {
    console.error('Error generating fingerprint:', error)
    return 'fallback_' + Date.now().toString(36)
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
 * Create session record in database
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
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
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
 * Revoke specific session (logout from device)
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

  if (error) {
    console.error('Failed to revoke session:', error)
    throw new Error('Failed to revoke session')
  }

  console.log('✅ Session revoked:', sessionId)
}

/**
 * Revoke all sessions except current one
 */
export async function revokeAllOtherSessions(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('No active session')
  }

  const currentToken = session.access_token

  const { error } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', session.user.id)
    .neq('session_token', currentToken)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to revoke other sessions:', error)
    throw new Error('Failed to revoke sessions')
  }

  console.log('✅ All other sessions revoked')
}

/**
 * Revoke all sessions for current user (logout everywhere)
 */
export async function revokeAllSessions(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('No active session')
  }

  const { error } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', session.user.id)
    .eq('is_active', true)

  if (error) {
    console.error('Failed to revoke all sessions:', error)
    throw new Error('Failed to revoke all sessions')
  }

  // Also sign out from Supabase
  await supabase.auth.signOut()

  console.log('✅ All sessions revoked and signed out')
}

/**
 * Cleanup expired sessions for current user
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return 0

  const { error, count } = await supabase
    .from('user_sessions')
    .update({ is_active: false })
    .eq('user_id', session.user.id)
    .lt('expires_at', new Date().toISOString())
    .eq('is_active', true)

  if (error) {
    console.error('Failed to cleanup expired sessions:', error)
    return 0
  }

  console.log(`✅ Cleaned up ${count || 0} expired sessions`)
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
