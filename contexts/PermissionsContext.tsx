'use client'

import { createContext, useContext, useMemo, useEffect } from 'react'
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
  isError: boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

// --- FETCHER ---
const fetchPermissions = async (): Promise<PermissionData> => {
  // authService đã có timeout, nên hàm này sẽ luôn trả về kết quả hoặc lỗi sau 7s
  const { session, error: sessionError } = await authService.getSession()

  if (sessionError || !session?.user) {
    return {
      isAuthenticated: false,
      isPremium: false,
      features: FREE_FEATURES,
      role: 'user',
      userId: null
    }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('membership, membership_expires_at, role')
    .eq('id', session.user.id)
    .single()

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
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig()

  const { data, error, isLoading } = useSWR('user-permissions', fetchPermissions, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
    fallbackData: {
      isAuthenticated: false,
      isPremium: false,
      features: FREE_FEATURES,
      role: 'user' as UserRole,
      userId: null
    }
  })

  // --- LOGIC RELOAD SAU 60s ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('last_background_time', Date.now().toString())
      } else if (document.visibilityState === 'visible') {
        const lastTime = sessionStorage.getItem('last_background_time')
        if (lastTime) {
          const timeAway = Date.now() - parseInt(lastTime)
          // Nếu rời đi > 60s -> Reload trang để làm mới hoàn toàn
          if (timeAway > 60 * 1000) {
            console.log('⏳ Away > 60s. Reloading...')
            window.location.reload()
          } else {
            // Nếu < 60s -> Chỉ gọi mutate nhẹ để check ngầm, không hiện loading
            mutate('user-permissions')
          }
        }
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
      isError: !!error,
      refresh
    }
  }, [data, isLoading, error])

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    // Trả về mặc định để tránh lỗi Build
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
      isLoading: true,
      isError: false,
      refresh: async () => {}
    }
  }
  return context
}
