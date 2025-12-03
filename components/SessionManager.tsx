'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * SessionManager Component
 *
 * Handles automatic token refresh to maintain 8-hour session
 * - Refreshes token 5 minutes before expiry
 * - Handles tab visibility changes
 * - Monitors user activity
 * - Persists session across browser restarts
 */
export default function SessionManager() {
  const refreshTimerRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    console.log('🔐 [SessionManager] Initializing...')

    // Schedule token refresh
    const scheduleRefresh = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.log('ℹ️ [SessionManager] No active session')
        return
      }

      const expiresAt = session.expires_at || 0
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = expiresAt - now

      // Refresh 5 minutes (300 seconds) before expiry
      const REFRESH_MARGIN = 300
      const timeUntilRefresh = Math.max(0, timeUntilExpiry - REFRESH_MARGIN)

      console.log(`⏰ [SessionManager] Session expires in ${Math.round(timeUntilExpiry / 60)} minutes`)
      console.log(`🔄 [SessionManager] Will refresh in ${Math.round(timeUntilRefresh / 60)} minutes`)

      // Clear existing timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      // Schedule refresh
      if (timeUntilRefresh > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          console.log('🔄 [SessionManager] Refreshing token...')

          const { data, error } = await supabase.auth.refreshSession()

          if (error) {
            console.error('❌ [SessionManager] Refresh failed:', error.message)
            return
          }

          if (data.session) {
            console.log('✅ [SessionManager] Token refreshed successfully')
            console.log(`   New expiry: ${new Date(data.session.expires_at! * 1000).toLocaleString()}`)

            // Schedule next refresh
            scheduleRefresh()
          }
        }, timeUntilRefresh * 1000)
      } else {
        // Session already expired or about to expire, refresh now
        console.log('⚠️ [SessionManager] Session expired or about to expire, refreshing now...')

        const { data, error } = await supabase.auth.refreshSession()

        if (error) {
          console.error('❌ [SessionManager] Refresh failed:', error.message)
          return
        }

        if (data.session) {
          console.log('✅ [SessionManager] Token refreshed successfully')
          scheduleRefresh()
        }
      }
    }

    // Initial schedule
    scheduleRefresh()

    // Handle tab visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [SessionManager] Tab became visible, checking session...')
        scheduleRefresh()
      }
    }

    // Track user activity
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔔 [SessionManager] Auth event: ${event}`)

      if (event === 'SIGNED_IN' && session) {
        console.log('✅ [SessionManager] User signed in')
        scheduleRefresh()
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 [SessionManager] User signed out')
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('🔄 [SessionManager] Token was refreshed externally')
        scheduleRefresh()
      }
    })

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', scheduleRefresh)
    document.addEventListener('click', updateActivity)
    document.addEventListener('keypress', updateActivity)
    document.addEventListener('scroll', updateActivity)

    // Cleanup
    return () => {
      console.log('🛑 [SessionManager] Cleaning up...')

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', scheduleRefresh)
      document.removeEventListener('click', updateActivity)
      document.removeEventListener('keypress', updateActivity)
      document.removeEventListener('scroll', updateActivity)

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

    const expiresAt = session.expires_at || 0
    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = expiresAt - now

    const info = {
      user: session.user.email,
      expiresAt: new Date(expiresAt * 1000).toLocaleString(),
      timeUntilExpiry: `${Math.floor(timeUntilExpiry / 3600)}h ${Math.floor((timeUntilExpiry % 3600) / 60)}m`,
      timeUntilExpirySeconds: timeUntilExpiry,
    }

    console.table(info)
    return info
  }

  console.log('💡 Tip: Run getSessionInfo() in console to check session status')
}
