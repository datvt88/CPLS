'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  createSessionRecord,
  updateSessionActivity,
  cleanupExpiredSessions
} from '@/lib/session-manager'

// OPTIMIZED: Enhanced background task handler with timeout
const runInBackground = async (task: () => Promise<any>, timeoutMs: number = 15000) => {
  try {
    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Background task timeout')), timeoutMs)
    )
    await Promise.race([task(), timeoutPromise])
  } catch (err) {
    console.warn('⚠️ Background task failed (non-critical):', err)
  }
}

export default function AuthListener() {
  // OPTIMIZED: Debounce timer for profile sync
  const syncTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // 1. Initial Check (Chạy 1 lần khi app khởi động)
    const initBackgroundTasks = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // OPTIMIZED: Chạy song song các tác vụ nền với timeout protection
          await Promise.allSettled([
            runInBackground(() => syncUserProfile(session.user), 10000),
            runInBackground(() => createSessionRecord(session.user.id, session.access_token), 10000),
            runInBackground(() => cleanupExpiredSessions(), 5000)
          ])
        }
      } catch (err) {
        console.error('❌ Initial background tasks error:', err)
      }
    }

    initBackgroundTasks()

    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 [AuthListener] Background event:', event)

      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // OPTIMIZED: Debounce profile sync to avoid rapid successive calls
          if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current)
          }

          syncTimerRef.current = setTimeout(() => {
            // Sync profile và session record khi đăng nhập
            runInBackground(() => syncUserProfile(session.user), 10000)
            runInBackground(() => createSessionRecord(session.user.id, session.access_token), 10000)
          }, 1000) // Debounce 1 second
        }

        if (event === 'TOKEN_REFRESHED') {
          // Chỉ update activity khi refresh token
          console.log('✅ Token refreshed - Updating activity log')
          runInBackground(() => updateSessionActivity(session.access_token), 5000)
        }
      }
    })

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current)
      }
      subscription.unsubscribe()
    }
  }, [])

  return null
}

/**
 * OPTIMIZED: Sync user profile data with better error handling
 * Chỉ update các trường cần thiết để giảm tải DB
 */
async function syncUserProfile(user: any) {
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
      console.error('❌ Error syncing profile:', error)
      throw error
    }

    console.log('✅ Profile synced successfully')
  } catch (e) {
    console.error('❌ Error in syncUserProfile:', e)
    throw e // Re-throw to be caught by runInBackground
  }
}
