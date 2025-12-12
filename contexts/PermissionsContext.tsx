'use client'

import { createContext, useContext, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES } from '@/lib/permissions'
import useSWR, { useSWRConfig } from 'swr'

// User role types
type UserRole = 'user' | 'mod' | 'admin'

interface PermissionData {
  isAuthenticated: boolean
  isPremium: boolean
  features: Feature[]
  role: UserRole
  userId: string | null
}

interface PermissionsContextValue {
  // Auth state
  isAuthenticated: boolean
  userId: string | null

  // Premium features
  isPremium: boolean
  accessibleFeatures: Feature[]
  canAccess: (feature: Feature) => boolean

  // Admin/Mod access
  role: UserRole
  isAdmin: boolean
  isMod: boolean
  hasAdminAccess: boolean // admin OR mod

  // Loading & Error states
  isLoading: boolean
  isRevalidating: boolean // Đang revalidate trong background
  isError: boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

// Default permissions (guest/unauthenticated)
const DEFAULT_PERMISSIONS: PermissionData = {
  isAuthenticated: false,
  isPremium: false,
  features: FREE_FEATURES,
  role: 'user',
  userId: null
}

// --- FETCHER with timeout ---
const fetchPermissions = async (): Promise<PermissionData> => {
  try {
    // Step 1: Get session with timeout
    const sessionPromise = supabase.auth.getSession()
    const sessionTimeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Session timeout')), 5000)
    )
    
    const { data: { session } } = await Promise.race([sessionPromise, sessionTimeoutPromise])

    if (!session?.user) {
      console.log('📭 [PermissionsContext] No session found')
      return DEFAULT_PERMISSIONS
    }

    const userId = session.user.id
    console.log('✅ [PermissionsContext] Session found for user:', userId.slice(0, 8))

    // Step 2: Fetch profile with timeout
    try {
      const profilePromise = supabase
        .from('profiles')
        .select('membership, membership_expires_at, role')
        .eq('id', userId)
        .single()
      
      const profileTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Profile timeout')), 5000)
      )

      const { data: profile, error } = await Promise.race([profilePromise, profileTimeoutPromise])

      if (error || !profile) {
        console.warn('⚠️ [PermissionsContext] Profile not found, using defaults')
        return {
          isAuthenticated: true,
          isPremium: false,
          features: FREE_FEATURES,
          role: 'user',
          userId: userId
        }
      }

      // Check premium status
      let userIsPremium = false
      if (profile.membership === 'premium') {
        if (profile.membership_expires_at) {
          const expiresAt = new Date(profile.membership_expires_at)
          userIsPremium = expiresAt.getTime() > Date.now()
        } else {
          userIsPremium = true
        }
      }

      // Get role (default to 'user' if not set)
      const userRole: UserRole = (profile.role as UserRole) || 'user'

      return {
        isAuthenticated: true,
        isPremium: userIsPremium,
        features: userIsPremium ? [...FREE_FEATURES, ...PREMIUM_FEATURES] : FREE_FEATURES,
        role: userRole,
        userId: userId
      }
    } catch (profileError) {
      console.warn('⚠️ [PermissionsContext] Profile fetch failed:', profileError)
      // Return authenticated state with default permissions
      return {
        isAuthenticated: true,
        isPremium: false,
        features: FREE_FEATURES,
        role: 'user',
        userId: userId
      }
    }
  } catch (error) {
    console.error('❌ [PermissionsContext] Fetch error:', error)
    return DEFAULT_PERMISSIONS
  }
}

// Timeout cho initialization
const INIT_TIMEOUT = 3000

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig()
  const [isInitialized, setIsInitialized] = useState(false)
  const initTimeoutRef = useRef<NodeJS.Timeout>()

  const { data, error, isLoading: swrLoading, isValidating } = useSWR(
    'user-permissions',
    fetchPermissions,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
      fallbackData: DEFAULT_PERMISSIONS,
      keepPreviousData: true,
      onSuccess: () => {
        setIsInitialized(true)
      },
      onError: () => {
        console.warn('⚠️ [PermissionsContext] Error during fetch - setting initialized')
        setIsInitialized(true)
      }
    }
  )

  // Safety timeout: force initialize after INIT_TIMEOUT
  useEffect(() => {
    initTimeoutRef.current = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⏱️ [PermissionsContext] Init timeout - forcing ready state')
        setIsInitialized(true)
      }
    }, INIT_TIMEOUT)

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
      }
    }
  }, [isInitialized])

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔔 [PermissionsContext] Auth event: ${event}`)
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
        // Revalidate permissions
        mutate('user-permissions')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [mutate])

  const canAccess = useCallback((feature: Feature): boolean => {
    return data?.features.includes(feature) ?? false
  }, [data])

  const refresh = useCallback(async () => {
    await mutate('user-permissions')
  }, [mutate])

  // isLoading = true chỉ khi chưa initialized VÀ đang fetch lần đầu
  const isLoading = !isInitialized && swrLoading

  const value = useMemo(() => {
    const role = data?.role ?? 'user'
    const isAdmin = role === 'admin'
    const isMod = role === 'mod'

    return {
      // Auth state
      isAuthenticated: data?.isAuthenticated ?? false,
      userId: data?.userId ?? null,

      // Premium features
      isPremium: data?.isPremium ?? false,
      accessibleFeatures: data?.features ?? FREE_FEATURES,
      canAccess,

      // Admin/Mod access
      role,
      isAdmin,
      isMod,
      hasAdminAccess: isAdmin || isMod,

      // Loading & Error states
      isLoading,
      isRevalidating: isValidating && isInitialized,
      isError: !!error,
      refresh
    }
  }, [data, isLoading, isValidating, isInitialized, error, canAccess, refresh])

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    console.warn('⚠️ [usePermissions] Called outside of PermissionsProvider')
    return {
      isAuthenticated: false,
      userId: null,
      isPremium: false,
      accessibleFeatures: FREE_FEATURES,
      canAccess: () => false,
      role: 'user' as UserRole,
      isAdmin: false,
      isMod: false,
      hasAdminAccess: false,
      isLoading: false,
      isRevalidating: false,
      isError: false,
      refresh: async () => {}
    }
  }
  return context
}
