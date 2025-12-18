'use client'

import { createContext, useContext, useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES, DIAMOND_FEATURES, getFeaturesForTier } from '@/lib/permissions'
import { getClaimsFromSession } from '@/lib/auth/helpers'
import {
  PERMISSIONS_INIT_TIMEOUT,
  SESSION_CACHE_TTL,
  PERMISSIONS_DEDUPE_INTERVAL
} from '@/lib/auth/constants'
import type { UserRole, PermissionData, CustomClaims, MembershipTier } from '@/types/auth'
import useSWR, { useSWRConfig } from 'swr'

interface PermissionsContextValue {
  // Auth state
  isAuthenticated: boolean
  userId: string | null

  // Membership tier
  membership: MembershipTier
  isPremium: boolean // true for premium or diamond
  isDiamond: boolean // true only for diamond

  // Features
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
  membership: 'free',
  isPremium: false,
  isDiamond: false,
  features: FREE_FEATURES,
  role: 'user',
  userId: null
}

// Session cache to avoid race condition - singleton pattern
let sessionCache: { session: any; timestamp: number } | null = null
let fetchInProgress: Promise<PermissionData> | null = null
// Track if a fresh session is required (after auth events)
let requireFreshSession = false

// Helper function to get cached session or fetch new one
const getCachedSession = async () => {
  // If fresh session is required (after auth event), bypass cache
  if (requireFreshSession) {
    console.log('🔄 [PermissionsContext] Fresh session required, bypassing cache')
    requireFreshSession = false
    const { data: { session } } = await supabase.auth.getSession()
    sessionCache = { session, timestamp: Date.now() }
    return session
  }
  
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
  requireFreshSession = true // Mark that next fetch needs fresh session
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

      // Step 2: Try to get claims from JWT first (faster, no DB query)
      const claims = getClaimsFromSession(session)
      // Check if claims are configured - any of the claim fields being set indicates custom_access_token_hook is active
      const hasValidClaims = claims.role !== undefined || claims.membership !== undefined || claims.is_premium !== undefined

      if (hasValidClaims) {
        console.log('🎫 [PermissionsContext] Using claims from JWT:', claims)
        const userMembership: MembershipTier = claims.membership || 'free'
        const userIsDiamond = userMembership === 'diamond'
        const userIsPremium = userIsDiamond || userMembership === 'premium'
        const userRole: UserRole = claims.role || 'user'

        return {
          isAuthenticated: true,
          membership: userMembership,
          isPremium: userIsPremium,
          isDiamond: userIsDiamond,
          features: getFeaturesForTier(userMembership),
          role: userRole,
          userId: userId
        }
      }

      // Step 3: Fallback - Fetch profile from database if no claims in JWT
      console.log('📊 [PermissionsContext] No JWT claims, fetching from database...')
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
            membership: 'free',
            isPremium: false,
            isDiamond: false,
            features: FREE_FEATURES,
            role: 'user',
            userId: userId
          }
        }

        // Check membership status (considering expiration)
        let userMembership: MembershipTier = (profile.membership as MembershipTier) || 'free'

        // Check if membership is expired
        if (profile.membership_expires_at && userMembership !== 'free') {
          const expiresAt = new Date(profile.membership_expires_at)
          if (expiresAt.getTime() <= Date.now()) {
            userMembership = 'free' // Expired, revert to free
          }
        }

        const userIsDiamond = userMembership === 'diamond'
        const userIsPremium = userIsDiamond || userMembership === 'premium'

        // Get role (default to 'user' if not set)
        const userRole: UserRole = (profile.role as UserRole) || 'user'

        return {
          isAuthenticated: true,
          membership: userMembership,
          isPremium: userIsPremium,
          isDiamond: userIsDiamond,
          features: getFeaturesForTier(userMembership),
          role: userRole,
          userId: userId
        }
      } catch (profileError) {
        console.warn('⚠️ [PermissionsContext] Profile fetch failed:', profileError)
        // Return authenticated state with default permissions
        return {
          isAuthenticated: true,
          membership: 'free',
          isPremium: false,
          isDiamond: false,
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
      dedupingInterval: PERMISSIONS_DEDUPE_INTERVAL,
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

  // Safety timeout: force initialize after PERMISSIONS_INIT_TIMEOUT
  useEffect(() => {
    initTimeoutRef.current = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⏱️ [PermissionsContext] Init timeout - forcing ready state')
        setIsInitialized(true)
      }
    }, PERMISSIONS_INIT_TIMEOUT)

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
      
      // Debounce the actual handling - reduced delay for faster sync
      eventDebounceRef.current = setTimeout(() => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
          // Clear session cache on auth events (this also sets requireFreshSession = true)
          clearSessionCache()
          
          // Revalidate permissions immediately for SIGNED_IN, with delay for others
          const revalidateDelay = event === 'SIGNED_IN' ? 100 : 300
          setTimeout(() => {
            mutate('user-permissions')
          }, revalidateDelay)
        }
        
        // Reset event tracking after debounce period
        setTimeout(() => {
          lastEventRef.current = ''
        }, 1500)
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
    const membership = data?.membership ?? 'free'

    return {
      // Auth state
      isAuthenticated: data?.isAuthenticated ?? false,
      userId: data?.userId ?? null,

      // Membership tier
      membership,
      isPremium: data?.isPremium ?? false,
      isDiamond: data?.isDiamond ?? false,

      // Features
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
      membership: 'free' as MembershipTier,
      isPremium: false,
      isDiamond: false,
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
