'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  createSessionRecord,
  updateSessionActivity,
  cleanupExpiredSessions
} from '@/lib/session-manager'

export default function AuthListener() {
  useEffect(() => {
    let mounted = true

    // Initialize session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user && mounted) {
        await syncUserProfile(session.user)

        // Create/update session record
        await createSessionRecord(session.user.id, session.access_token)

        // Cleanup expired sessions
        await cleanupExpiredSessions()
      }
    })

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('🔔 [AuthListener] Auth state changed:', event)

      try {
        const user = session?.user

        if (user && session) {
          // Handle signed in events
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
            await syncUserProfile(user)

            // Create session record
            await createSessionRecord(user.id, session.access_token)

            // Cleanup old sessions
            await cleanupExpiredSessions()
          }

          // Handle token refresh
          if (event === 'TOKEN_REFRESHED') {
            console.log('✅ [AuthListener] Token refreshed by PersistentSessionManager')
            // Update session activity after token refresh
            await updateSessionActivity(session.access_token)
          }
        }
      } catch (e) {
        console.error('❌ [AuthListener] Auth state change error:', e)
      }
    })

    // Cleanup
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

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
