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

// Session cache để tránh race condition - singleton pattern
let sessionCache: { session: any; timestamp: number } | null = null
const SESSION_CACHE_TTL = 10000 // 10 seconds cache
let fetchInProgress: Promise<PermissionData> | null = null

// Helper function to get cached session or fetch new one
const getCachedSession = async () => {
  // Check if cache is still valid
  if (sessionCache && (Date.now() - sessionCache.timestamp) < SESSION_CACHE_TTL) {
    return sessionCache.session
  }
  
  // Fetch fresh session
  const { data: { session } } = await supabase.auth.getSession()
  sessionCache = { session, timestamp: Date.now() }
  return session
}

// Clear session cache when auth state changes
const clearSessionCache = () => {
  sessionCache = null
  fetchInProgress = null
}

// Update session cache with new session
const updateSessionCache = (session: any) => {
  sessionCache = { session, timestamp: Date.now() }
}

// --- FETCHER with timeout and deduplication ---
const fetchPermissions = async (): Promise<PermissionData> => {
  // Dedupe concurrent requests
  if (fetchInProgress) {
    return fetchInProgress
  }
  
  fetchInProgress = (async () => {
    try {
      // Step 1: Get session with timeout
      const sessionPromise = getCachedSession()
      const sessionTimeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 8000)
      )
      
      const session = await Promise.race([sessionPromise, sessionTimeoutPromise])

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
          setTimeout(() => reject(new Error('Profile timeout')), 8000)
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
    } finally {
      // Clear fetch in progress after a short delay to allow deduping
      setTimeout(() => {
        fetchInProgress = null
      }, 500)
    }
  })()
  
  return fetchInProgress
}

// Timeout for initialization - increased from 3s to 8s to allow auth to stabilize
const INIT_TIMEOUT = 8000

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig()
  const [isInitialized, setIsInitialized] = useState(false)
  const initTimeoutRef = useRef<NodeJS.Timeout>()
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const lastEventRef = useRef<string>('')
  const eventDebounceRef = useRef<NodeJS.Timeout>()

  const { data, error, isLoading: swrLoading, isValidating } = useSWR(
    'user-permissions',
    fetchPermissions,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Tăng lên 60s để tránh duplicate fetches
      fallbackData: DEFAULT_PERMISSIONS,
      keepPreviousData: true,
      errorRetryCount: 2,
      errorRetryInterval: 3000,
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

  // Listen for auth state changes - with debounce to prevent rapid fire events
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Debounce rapid events (same event within 1s)
      const eventKey = `${event}-${session?.user?.id || 'none'}`
      if (lastEventRef.current === eventKey) {
        return
      }
      
      // Clear previous debounce timer
      if (eventDebounceRef.current) {
        clearTimeout(eventDebounceRef.current)
      }
      
      console.log(`🔔 [PermissionsContext] Auth event: ${event}`)
      lastEventRef.current = eventKey
      
      // For SIGNED_IN, revalidate immediately to reduce login delay
      if (event === 'SIGNED_IN') {
        clearSessionCache()
        // Update session cache immediately with current session
        if (session) {
          updateSessionCache(session)
        }
        // Revalidate immediately for login
        mutate('user-permissions')
        
        // Reset event tracking after debounce period
        setTimeout(() => {
          lastEventRef.current = ''
        }, 2000)
        return
      }
      
      // Debounce the actual handling for other events
      eventDebounceRef.current = setTimeout(() => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
          // Clear session cache on auth events
          clearSessionCache()
          
          // Revalidate permissions with a small delay to let Supabase stabilize
          setTimeout(() => {
            mutate('user-permissions')
          }, 500)
        }
        
        // Reset event tracking after debounce period
        setTimeout(() => {
          lastEventRef.current = ''
        }, 2000)
      }, 300)
    })
    
    authSubscriptionRef.current = subscription

    return () => {
      if (eventDebounceRef.current) {
        clearTimeout(eventDebounceRef.current)
      }
      subscription.unsubscribe()
    }
  }, [mutate])

  const canAccess = useCallback((feature: Feature): boolean => {
    return data?.features.includes(feature) ?? false
  }, [data])

  const refresh = useCallback(async () => {
    clearSessionCache() // Clear cache before refresh
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
