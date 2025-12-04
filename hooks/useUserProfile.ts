'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  phone_number: string | null
  role: 'user' | 'mod' | 'admin'
  membership: 'free' | 'premium'
  membership_expires_at: string | null
  provider: string
}

interface UseUserProfileReturn {
  profile: UserProfile | null
  loading: boolean
  error: Error | null
  isPremium: boolean
  isAdmin: boolean
  isMod: boolean
  refetch: () => Promise<void>
  clearCache: () => void
}

const CACHE_KEY = 'user_profile_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CacheData {
  profile: UserProfile
  timestamp: number
}

/**
 * Hook to fetch and cache user profile with permissions
 * Reduces database queries by caching in memory + localStorage
 */
export function useUserProfile(): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Helper to get cached profile
  const getCachedProfile = useCallback((): UserProfile | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const data: CacheData = JSON.parse(cached)
      const age = Date.now() - data.timestamp

      // Return cached if less than 5 minutes old
      if (age < CACHE_DURATION) {
        console.log(`📦 [useUserProfile] Using cached profile (age: ${Math.round(age / 1000)}s)`)
        return data.profile
      }

      console.log('⏰ [useUserProfile] Cache expired, will refetch')
      return null
    } catch {
      return null
    }
  }, [])

  // Helper to set cached profile
  const setCachedProfile = useCallback((profile: UserProfile) => {
    try {
      const data: CacheData = {
        profile,
        timestamp: Date.now()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      console.log('✅ [useUserProfile] Profile cached')
    } catch (e) {
      console.warn('⚠️ [useUserProfile] Failed to cache profile:', e)
    }
  }, [])

  // Fetch profile from database
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Check cache first
      const cached = getCachedProfile()
      if (cached) {
        setProfile(cached)
        setLoading(false)
        return
      }

      // Get current session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setProfile(null)
        setLoading(false)
        return
      }

      console.log('🔍 [useUserProfile] Fetching profile from database...')

      // Fetch from database
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (fetchError) {
        throw fetchError
      }

      if (data) {
        setProfile(data as UserProfile)
        setCachedProfile(data as UserProfile)
        console.log('✅ [useUserProfile] Profile fetched and cached')
      }

      setLoading(false)
    } catch (err) {
      console.error('❌ [useUserProfile] Error fetching profile:', err)
      setError(err as Error)
      setLoading(false)
    }
  }, [getCachedProfile, setCachedProfile])

  // Clear cache manually
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY)
    console.log('🗑️ [useUserProfile] Cache cleared')
  }, [])

  // Refetch profile (bypass cache)
  const refetch = useCallback(async () => {
    clearCache()
    await fetchProfile()
  }, [clearCache, fetchProfile])

  // Auto-fetch on mount
  useEffect(() => {
    fetchProfile()

    // Listen for auth changes to refetch
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        console.log('🔔 [useUserProfile] Auth changed, refetching...')
        await refetch()
      } else if (event === 'SIGNED_OUT') {
        clearCache()
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile, refetch, clearCache])

  // Computed properties
  const isPremium = profile?.membership === 'premium' && (
    !profile.membership_expires_at ||
    new Date(profile.membership_expires_at) > new Date()
  )

  const isAdmin = profile?.role === 'admin'
  const isMod = profile?.role === 'mod'

  return {
    profile,
    loading,
    error,
    isPremium,
    isAdmin,
    isMod,
    refetch,
    clearCache
  }
}
