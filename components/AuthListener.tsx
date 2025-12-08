'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  createSessionRecord,
  updateSessionActivity,
  cleanupExpiredSessions
} from '@/lib/session-manager'

// Timeout helper riêng cho background tasks (để lâu hơn chút, 15s)
const runInBackground = async (task: () => Promise<any>) => {
  try {
    await task()
  } catch (err) {
    console.warn('⚠️ Background task failed (non-critical):', err)
  }
}

export default function AuthListener() {
  useEffect(() => {
    // 1. Initial Check (Chạy 1 lần khi app khởi động)
    const initBackgroundTasks = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // Chạy song song các tác vụ nền, không await từng cái để tránh chặn nhau
        runInBackground(() => syncUserProfile(session.user))
        runInBackground(() => createSessionRecord(session.user.id, session.access_token))
        runInBackground(() => cleanupExpiredSessions())
      }
    }
    
    initBackgroundTasks()

    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 [AuthListener] Background event:', event)

      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // Sync profile và session record khi đăng nhập
          runInBackground(() => syncUserProfile(session.user))
          runInBackground(() => createSessionRecord(session.user.id, session.access_token))
        }

        if (event === 'TOKEN_REFRESHED') {
          // Chỉ update activity khi refresh token
          console.log('✅ Token refreshed - Updating activity log')
          runInBackground(() => updateSessionActivity(session.access_token))
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}

/**
 * Sync user profile data (Optimized)
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
      // Chỉ update updated_at nếu có thay đổi thực sự (Supabase tự lo việc này nếu data giống nhau)
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, {
        onConflict: 'id',
        ignoreDuplicates: false, // Update nếu đã tồn tại
      })

    if (error) console.error('Error syncing profile:', error)
    
  } catch (e) {
    console.error('Error in syncUserProfile:', e)
  }
}
