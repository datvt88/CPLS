'use client'

import { createContext, useContext, useMemo, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
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
    // authService đã có timeout 7s
    const { session, error: sessionError } = await authService.getSession()

    if (sessionError || !session?.user) {
      return DEFAULT_PERMISSIONS
    }

    // Fetch profile with timeout
    const profilePromise = supabase
      .from('profiles')
      .select('membership, membership_expires_at, role')
      .eq('id', session.user.id)
      .single()

    // Race with timeout
    const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
    )

    const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise])

    if (error || !profile) {
      return {
        isAuthenticated: true,
        isPremium: false,
        features: FREE_FEATURES,
        role: 'user',
        userId: session.user.id
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
      userId: session.user.id
    }
  } catch (error) {
    console.error('❌ [PermissionsContext] Fetch error:', error)
    return DEFAULT_PERMISSIONS
  }
}

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
      dedupingInterval: 30000, // Giảm xuống 30s cho responsive hơn
      fallbackData: DEFAULT_PERMISSIONS,
      // Giữ data cũ trong khi revalidate để tránh flash
      keepPreviousData: true,
      onSuccess: () => {
        setIsInitialized(true)
      }
    }
  )

  // Safety timeout: force initialize after 5s to prevent infinite loading
  useEffect(() => {
    initTimeoutRef.current = setTimeout(() => {
      if (!isInitialized) {
        console.warn('⏱️ [PermissionsContext] Init timeout - forcing ready state')
        setIsInitialized(true)
      }
    }, 5000)

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current)
      }
    }
  }, [isInitialized])

  // --- VISIBILITY CHANGE: Revalidate khi quay lại app ---
  // KHÔNG reload trang, chỉ refresh data ngầm
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [PermissionsContext] App visible - refreshing permissions...')
        // Chỉ mutate để refresh, KHÔNG reload trang
        // SWR sẽ giữ data cũ trong khi fetch mới (keepPreviousData: true)
        mutate('user-permissions')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [mutate])

  const canAccess = (feature: Feature): boolean => {
    return data?.features.includes(feature) ?? false
  }

  const refresh = async () => {
    await mutate('user-permissions')
  }

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
      isRevalidating: isValidating && isInitialized, // Đang refresh ngầm
      isError: !!error,
      refresh
    }
  }, [data, isLoading, isValidating, isInitialized, error])

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
