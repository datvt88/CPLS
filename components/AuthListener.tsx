'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  createSessionRecord,
  updateSessionActivity,
  cleanupExpiredSessions
} from '@/lib/session-manager'

export default function AuthListener() {
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let mounted = true

    // Initialize session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && mounted) {
        await syncUserProfile(session.user)

        // Create/update session record
        await createSessionRecord(session.user.id, session.access_token)

        // Start keepalive for active session
        startSessionKeepalive()

        // Start activity tracking
        startActivityTracking(session.access_token)

        // Cleanup expired sessions
        await cleanupExpiredSessions()
      }
    })

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state changed:', event)

      try {
        const user = session?.user

        if (user && session) {
          // Handle signed in events
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
            await syncUserProfile(user)

            // Create session record
            await createSessionRecord(user.id, session.access_token)

            // Start tracking
            startSessionKeepalive()
            startActivityTracking(session.access_token)

            // Cleanup old sessions
            await cleanupExpiredSessions()
          }

          // Handle token refresh
          if (event === 'TOKEN_REFRESHED') {
            console.log('✅ Token refreshed successfully')
          }
        } else {
          // User signed out - stop tracking
          if (event === 'SIGNED_OUT') {
            stopSessionKeepalive()
            stopActivityTracking()
          }
        }
      } catch (e) {
        console.error('Auth state change error:', e)
      }
    })

    // Start keepalive immediately if there's a session
    startSessionKeepalive()

    // Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
      stopSessionKeepalive()
      stopActivityTracking()
    }
  }, [])

  /**
   * Start session keepalive
   * Refreshes token every 50 minutes (tokens expire after 60 minutes)
   */
  const startSessionKeepalive = () => {
    // Don't start multiple intervals
    if (keepAliveIntervalRef.current) {
      return
    }

    // Refresh session every 50 minutes
    keepAliveIntervalRef.current = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (session) {
          console.log('🔄 Refreshing session...')
          const { data, error: refreshError } = await supabase.auth.refreshSession()

          if (refreshError) {
            console.error('❌ Failed to refresh session:', refreshError)
            // Don't stop keepalive on error - will retry next interval
          } else if (data.session) {
            console.log('✅ Session refreshed successfully')
          }
        } else {
          // No session - stop keepalive
          console.log('⚠️ No session in keepalive check - stopping')
          stopSessionKeepalive()
        }
      } catch (error) {
        console.error('Session keepalive error:', error)
      }
    }, 50 * 60 * 1000) // 50 minutes in milliseconds

    console.log('🔐 Session keepalive started (refresh every 50 min)')
  }

  /**
   * Stop session keepalive
   */
  const stopSessionKeepalive = () => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current)
      keepAliveIntervalRef.current = null
      console.log('🔓 Session keepalive stopped')
    }
  }

  /**
   * Start activity tracking
   * Updates last_activity timestamp every 5 minutes
   */
  const startActivityTracking = (sessionToken: string) => {
    // Don't start multiple intervals
    if (activityIntervalRef.current) {
      return
    }

    // Update activity every 5 minutes
    activityIntervalRef.current = setInterval(async () => {
      try {
        await updateSessionActivity(sessionToken)
        console.log('📊 Session activity updated')
      } catch (error) {
        console.error('Failed to update session activity:', error)
      }
    }, 5 * 60 * 1000) // 5 minutes

    console.log('📊 Activity tracking started (update every 5 min)')
  }

  /**
   * Stop activity tracking
   */
  const stopActivityTracking = () => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current)
      activityIntervalRef.current = null
      console.log('📊 Activity tracking stopped')
    }
  }

  return null
}

/**
 * Sync user profile data from auth.users to public.profiles
 * Supports Google OAuth, phone auth, and other providers
 */
async function syncUserProfile(user: any) {
  try {
    const provider = user.app_metadata?.provider || 'email'
    const userMetadata = user.user_metadata || {}

    // Extract profile data from user metadata (Google OAuth provides this)
    const profileData = {
      id: user.id,
      email: user.email || '',
      full_name: userMetadata.full_name || userMetadata.name || null,
      avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
      phone_number: userMetadata.phone_number || userMetadata.phone || null,
      provider: provider,
      provider_id: userMetadata.sub || userMetadata.provider_id || null,
      updated_at: new Date().toISOString(),
    }

    // Upsert profile (update if exists, insert if not)
    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })

    if (error) {
      console.error('Error syncing profile:', error)
    } else {
      console.log('✅ Profile synced successfully for user:', user.id.slice(0, 8))
    }
  } catch (e) {
    console.error('Error in syncUserProfile:', e)
  }
}
