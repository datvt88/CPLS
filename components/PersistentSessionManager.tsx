'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  createSessionRecord,
  updateSessionActivity,
  getDeviceFingerprint,
  cleanupExpiredSessions
} from '@/lib/session-manager'

const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds

/**
 * PersistentSessionManager Component
 *
 * Quản lý toàn bộ session và authentication:
 * 1. Token refresh tự động (5 phút trước khi hết hạn)
 * 2. Session persistence 30 ngày
 * 3. Device fingerprinting & multi-device management (max 3 devices)
 * 4. Profile sync khi đăng nhập
 * 5. Inactivity logout (30 ngày không hoạt động)
 * 6. Tab visibility handling
 */
export default function PersistentSessionManager() {
  const refreshTimerRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())
  const sessionIdRef = useRef<string | null>(null)
  const checkIntervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    console.log('🔐 [SessionManager] Initializing...')

    // === BACKGROUND TASK RUNNER ===
    const runInBackground = async (task: () => Promise<any>, name?: string) => {
      try {
        await task()
      } catch (err) {
        console.warn(`⚠️ [SessionManager] Background task ${name || ''} failed (non-critical):`, err)
      }
    }

    // === SYNC USER PROFILE ===
    const syncUserProfile = async (user: any) => {
      try {
        const provider = user.app_metadata?.provider || 'email'
        const userMetadata = user.user_metadata || {}

        const profileData = {
          id: user.id,
          email: user.email || '',
          full_name: userMetadata.full_name || userMetadata.name || null,
          avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
          provider: provider,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('profiles')
          .upsert(profileData, {
            onConflict: 'id',
            ignoreDuplicates: false,
          })

        if (error) {
          console.error('❌ [SessionManager] Profile sync error:', error)
        } else {
          console.log('✅ [SessionManager] Profile synced')
        }
      } catch (e) {
        console.error('❌ [SessionManager] Profile sync failed:', e)
      }
    }

    // === INITIALIZE SESSION ===
    const initializeSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.log('ℹ️ [SessionManager] No active session')
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
        console.error('❌ [SessionManager] Error checking session:', checkError)
        return
      }

      if (existingSession) {
        console.log('✅ [SessionManager] Found existing session for this device')
        sessionIdRef.current = existingSession.id

        // Check if inactive for > 30 days
        const lastActivity = new Date(existingSession.last_activity).getTime()
        const daysSinceActivity = (Date.now() - lastActivity) / (24 * 60 * 60 * 1000)

        if (daysSinceActivity > 30) {
          console.log(`⏰ [SessionManager] Session inactive for ${daysSinceActivity.toFixed(1)} days - logging out`)
          await handleInactivityLogout(existingSession.id)
          return
        }

        // Update activity timestamp
        await updateSessionActivity(session.access_token)
      } else {
        console.log('🆕 [SessionManager] New device detected - creating session record')

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

    // === SCHEDULE TOKEN REFRESH ===
    const scheduleRefresh = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) return

      const expiresAt = session.expires_at || 0
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = expiresAt - now

      // Refresh 5 minutes before expiry
      const REFRESH_MARGIN = 300
      const timeUntilRefresh = Math.max(0, timeUntilExpiry - REFRESH_MARGIN)

      console.log(`⏰ [SessionManager] Session expires in ${Math.round(timeUntilExpiry / 60)} minutes`)

      // Clear existing timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      // Helper: Refresh với retry
      const refreshWithRetry = async (maxRetries: number = 3): Promise<boolean> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`🔄 [SessionManager] Refreshing token (attempt ${attempt}/${maxRetries})...`)
            
            const { data, error } = await supabase.auth.refreshSession()

            if (error) {
              console.error(`❌ [SessionManager] Refresh attempt ${attempt} failed:`, error.message)
              
              if (attempt < maxRetries) {
                // Exponential backoff: 1s, 2s, 4s
                const backoffDelay = Math.pow(2, attempt - 1) * 1000
                console.log(`⏳ [SessionManager] Retrying in ${backoffDelay}ms...`)
                await new Promise(resolve => setTimeout(resolve, backoffDelay))
                continue
              }
              return false
            }

            if (data.session) {
              console.log('✅ [SessionManager] Token refreshed successfully')

              // Update session activity
              if (sessionIdRef.current) {
                await updateSessionActivity(data.session.access_token)
              }

              // Schedule next refresh
              scheduleRefresh()
              return true
            }
          } catch (err) {
            console.error(`❌ [SessionManager] Refresh attempt ${attempt} error:`, err)
            if (attempt < maxRetries) {
              const backoffDelay = Math.pow(2, attempt - 1) * 1000
              await new Promise(resolve => setTimeout(resolve, backoffDelay))
            }
          }
        }
        return false
      }

      // Schedule refresh
      if (timeUntilRefresh > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          const success = await refreshWithRetry(3)
          if (!success) {
            console.error('❌ [SessionManager] All refresh attempts failed')
            // Không tự động logout, để user có cơ hội retry
            // Thử lại sau 1 phút
            refreshTimerRef.current = setTimeout(() => {
              console.log('🔄 [SessionManager] Retrying token refresh after failure...')
              scheduleRefresh()
            }, 60 * 1000)
          }
        }, timeUntilRefresh * 1000)
      } else {
        // Session expired or about to expire, refresh now
        console.log('⚠️ [SessionManager] Session expiring soon, refreshing now...')

        const success = await refreshWithRetry(3)
        if (!success) {
          console.error('❌ [SessionManager] All refresh attempts failed')
          // Schedule retry sau 30 giây
          refreshTimerRef.current = setTimeout(() => {
            console.log('🔄 [SessionManager] Retrying after immediate refresh failure...')
            scheduleRefresh()
          }, 30 * 1000)
        }
      }
    }

    // === INACTIVITY CHECKER ===
    const startInactivityChecker = () => {
      // Check every hour
      checkIntervalRef.current = setInterval(async () => {
        const timeSinceActivity = Date.now() - lastActivityRef.current

        if (timeSinceActivity > INACTIVITY_TIMEOUT) {
          console.log('⏰ [SessionManager] Inactive for 30+ days - logging out')

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

    // === HANDLE INACTIVITY LOGOUT ===
    const handleInactivityLogout = async (sessionId: string) => {
      // Mark session as inactive
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId)

      // Sign out
      await supabase.auth.signOut()

      console.log('👋 [SessionManager] Logged out due to inactivity')

      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    // === TAB VISIBILITY HANDLER ===
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [SessionManager] Tab became visible, checking session...')

        // Update last activity
        lastActivityRef.current = Date.now()

        // Check session validity
        initializeSession()
      }
    }

    // === USER ACTIVITY TRACKER ===
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // === AUTH STATE CHANGE LISTENER ===
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [SessionManager] Auth event: ${event}`)

      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          console.log('✅ [SessionManager] User signed in')

          // Background tasks (non-blocking)
          runInBackground(() => syncUserProfile(session.user), 'syncProfile')
          runInBackground(() => cleanupExpiredSessions(), 'cleanup')

          // Initialize session
          initializeSession()
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 [SessionManager] Token was refreshed')
          runInBackground(() => updateSessionActivity(session.access_token), 'updateActivity')
          scheduleRefresh()
        }
      }

      if (event === 'SIGNED_OUT') {
        console.log('👋 [SessionManager] User signed out')

        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
        }
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
        }

        sessionIdRef.current = null
      }
    })

    // === INITIAL SETUP ===
    initializeSession()

    // Run cleanup on startup
    runInBackground(() => cleanupExpiredSessions(), 'initialCleanup')

    // === EVENT LISTENERS ===
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', updateActivity)
    document.addEventListener('click', updateActivity)
    document.addEventListener('keypress', updateActivity)
    document.addEventListener('scroll', updateActivity)
    document.addEventListener('mousemove', updateActivity)

    // === CLEANUP ===
    return () => {
      console.log('🛑 [SessionManager] Cleaning up...')

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
    }

    console.table(info)
    return info
  }

  console.log('💡 Tip: Run getSessionInfo() in console to check session status')
}
