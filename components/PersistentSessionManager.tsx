'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { createSessionRecord, updateSessionActivity, getDeviceFingerprint } from '@/lib/session-manager'

const INACTIVITY_TIMEOUT = 3 * 24 * 60 * 60 * 1000 // 3 days in milliseconds

/**
 * PersistentSessionManager Component
 *
 * Manages long-lived sessions with the following rules:
 * 1. User stays logged in on their existing browsers (persistent)
 * 2. Only logout when:
 *    - Login from a NEW device
 *    - No activity for 3+ days
 * 3. Refresh token valid for 90 days
 * 4. No device limit - all existing devices stay logged in
 */
export default function PersistentSessionManager() {
  const refreshTimerRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())
  const sessionIdRef = useRef<string | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    console.log('🔐 [PersistentSessionManager] Initializing...')

    const initializeSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.log('ℹ️ [PersistentSessionManager] No active session')
        return
      }

      // Get device fingerprint
      const fingerprint = await getDeviceFingerprint()

      // Check if session exists for this device
      const { data: existingSession, error: checkError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('fingerprint', fingerprint)
        .eq('is_active', true)
        .maybeSingle()

      if (checkError) {
        console.error('❌ [PersistentSessionManager] Error checking session:', checkError)
        return
      }

      if (existingSession) {
        console.log('✅ [PersistentSessionManager] Found existing session for this device')
        sessionIdRef.current = existingSession.id

        // Check if inactive for > 3 days
        const lastActivity = new Date(existingSession.last_activity).getTime()
        const daysSinceActivity = (Date.now() - lastActivity) / (24 * 60 * 60 * 1000)

        if (daysSinceActivity > 3) {
          console.log(`⏰ [PersistentSessionManager] Session inactive for ${daysSinceActivity.toFixed(1)} days - logging out`)
          await handleInactivityLogout(existingSession.id)
          return
        }

        // Update activity timestamp
        await updateSessionActivity(session.access_token)
      } else {
        console.log('🆕 [PersistentSessionManager] New device detected - creating session record')

        // Create new session record for this device
        const sessionId = await createSessionRecord(
          session.user.id,
          session.access_token,
          fingerprint
        )

        if (sessionId) {
          sessionIdRef.current = sessionId
        }
      }

      // Schedule token refresh
      scheduleRefresh()

      // Start inactivity checker
      startInactivityChecker()
    }

    const scheduleRefresh = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) return

      const expiresAt = session.expires_at || 0
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = expiresAt - now

      // Refresh 5 minutes before expiry
      const REFRESH_MARGIN = 300
      const timeUntilRefresh = Math.max(0, timeUntilExpiry - REFRESH_MARGIN)

      console.log(`⏰ [PersistentSessionManager] Session expires in ${Math.round(timeUntilExpiry / 60)} minutes`)

      // Clear existing timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      // Schedule refresh
      if (timeUntilRefresh > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          console.log('🔄 [PersistentSessionManager] Refreshing token...')

          const { data, error } = await supabase.auth.refreshSession()

          if (error) {
            console.error('❌ [PersistentSessionManager] Refresh failed:', error.message)
            return
          }

          if (data.session) {
            console.log('✅ [PersistentSessionManager] Token refreshed successfully')

            // Update session activity
            if (sessionIdRef.current) {
              await updateSessionActivity(data.session.access_token)
            }

            // Schedule next refresh
            scheduleRefresh()
          }
        }, timeUntilRefresh * 1000)
      } else {
        // Session expired or about to expire, refresh now
        console.log('⚠️ [PersistentSessionManager] Session expiring soon, refreshing now...')

        const { data, error } = await supabase.auth.refreshSession()

        if (error) {
          console.error('❌ [PersistentSessionManager] Refresh failed:', error.message)
          return
        }

        if (data.session) {
          console.log('✅ [PersistentSessionManager] Token refreshed successfully')
          scheduleRefresh()
        }
      }
    }

    const startInactivityChecker = () => {
      // Check every hour
      checkIntervalRef.current = setInterval(async () => {
        const timeSinceActivity = Date.now() - lastActivityRef.current

        if (timeSinceActivity > INACTIVITY_TIMEOUT) {
          console.log('⏰ [PersistentSessionManager] Inactive for 3+ days - logging out')

          if (sessionIdRef.current) {
            await handleInactivityLogout(sessionIdRef.current)
          }
        } else {
          // Update session activity in database
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            await updateSessionActivity(session.access_token)
          }
        }
      }, 60 * 60 * 1000) // Check every hour
    }

    const handleInactivityLogout = async (sessionId: string) => {
      // Mark session as inactive
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)

      // Sign out
      await supabase.auth.signOut()

      console.log('👋 [PersistentSessionManager] Logged out due to inactivity')

      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    // Handle tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [PersistentSessionManager] Tab became visible, checking session...')

        // Update last activity
        lastActivityRef.current = Date.now()

        // Check session validity
        initializeSession()
      }
    }

    // Track user activity
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔔 [PersistentSessionManager] Auth event: ${event}`)

      if (event === 'SIGNED_IN' && session) {
        console.log('✅ [PersistentSessionManager] User signed in')
        initializeSession()
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 [PersistentSessionManager] User signed out')

        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
        }

        sessionIdRef.current = null
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('🔄 [PersistentSessionManager] Token was refreshed externally')
        scheduleRefresh()
      }
    })

    // Initial setup
    initializeSession()

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', updateActivity)
    document.addEventListener('click', updateActivity)
    document.addEventListener('keypress', updateActivity)
    document.addEventListener('scroll', updateActivity)
    document.addEventListener('mousemove', updateActivity)

    // Cleanup
    return () => {
      console.log('🛑 [PersistentSessionManager] Cleaning up...')

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', updateActivity)
      document.removeEventListener('click', updateActivity)
      document.removeEventListener('keypress', updateActivity)
      document.removeEventListener('scroll', updateActivity)
      document.removeEventListener('mousemove', updateActivity)

      authListener.subscription.unsubscribe()
    }
  }, [])

  // This component doesn't render anything
  return null
}

/**
 * Helper function to get session info
 * Can be called from browser console for debugging
 */
if (typeof window !== 'undefined') {
  (window as any).getSessionInfo = async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      console.log('❌ No active session')
      return null
    }

    // Get session from database
    const fingerprint = await getDeviceFingerprint()
    const { data: dbSession } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('fingerprint', fingerprint)
      .eq('is_active', true)
      .maybeSingle()

    const expiresAt = session.expires_at || 0
    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = expiresAt - now

    const info = {
      user: session.user.email,
      jwtExpiresAt: new Date(expiresAt * 1000).toLocaleString(),
      timeUntilExpiry: `${Math.floor(timeUntilExpiry / 3600)}h ${Math.floor((timeUntilExpiry % 3600) / 60)}m`,
      deviceFingerprint: fingerprint,
      lastActivity: dbSession ? new Date(dbSession.last_activity).toLocaleString() : 'N/A',
      daysSinceActivity: dbSession
        ? ((Date.now() - new Date(dbSession.last_activity).getTime()) / (24 * 60 * 60 * 1000)).toFixed(2)
        : 'N/A',
      willLogoutAt: dbSession
        ? new Date(new Date(dbSession.last_activity).getTime() + INACTIVITY_TIMEOUT).toLocaleString()
        : 'N/A'
    }

    console.table(info)
    return info
  }

  console.log('💡 Tip: Run getSessionInfo() in console to check session status')
}
