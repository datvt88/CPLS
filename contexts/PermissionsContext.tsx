'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES } from '@/lib/permissions'

interface Profile {
  membership: 'free' | 'premium'
  membership_expires_at: string | null
}

interface PermissionsContextValue {
  isPremium: boolean
  accessibleFeatures: Feature[]
  canAccess: (feature: Feature) => boolean
  isLoading: boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

/**
 * PermissionsProvider - Cache permissions in memory to reduce RPC calls
 * Automatically refreshes when auth state changes
 */
export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false)
  const [accessibleFeatures, setAccessibleFeatures] = useState<Feature[]>(FREE_FEATURES)
  const [isLoading, setIsLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Not logged in - free access only
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        setIsLoading(false)
        return
      }

      // Get user profile with membership info
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('membership, membership_expires_at')
        .eq('id', session.user.id)
        .single<Profile>()

      if (error || !profile) {
        console.error('❌ [PermissionsContext] Error loading profile:', error)
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        setIsLoading(false)
        return
      }

      // Check if premium
      let userIsPremium = false

      if (profile.membership === 'premium') {
        // Check expiry
        if (profile.membership_expires_at) {
          const expiresAt = new Date(profile.membership_expires_at)
          userIsPremium = expiresAt > new Date()
        } else {
          // Lifetime premium
          userIsPremium = true
        }
      }

      setIsPremium(userIsPremium)

      // Set accessible features
      if (userIsPremium) {
        setAccessibleFeatures([...FREE_FEATURES, ...PREMIUM_FEATURES])
      } else {
        setAccessibleFeatures(FREE_FEATURES)
      }

      console.log(`✅ [PermissionsContext] Loaded permissions - Premium: ${userIsPremium}`)
    } catch (error) {
      console.error('❌ [PermissionsContext] Error:', error)
      setIsPremium(false)
      setAccessibleFeatures(FREE_FEATURES)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial load
    loadPermissions()

    // Listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      console.log(`🔔 [PermissionsContext] Auth event: ${event}`)

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadPermissions()
      } else if (event === 'SIGNED_OUT') {
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [loadPermissions])

  const canAccess = useCallback((feature: Feature): boolean => {
    return accessibleFeatures.includes(feature)
  }, [accessibleFeatures])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    await loadPermissions()
  }, [loadPermissions])

  const value = useMemo(() => ({
    isPremium,
    accessibleFeatures,
    canAccess,
    isLoading,
    refresh
  }), [isPremium, accessibleFeatures, canAccess, isLoading, refresh])

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

/**
 * Hook to access permissions context
 */
export function usePermissions() {
  const context = useContext(PermissionsContext)

  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }

  return context
}
