'use client'

import { createContext, useContext, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES } from '@/lib/permissions'
import useSWR, { useSWRConfig } from 'swr' 

interface PermissionData {
  isAuthenticated: boolean
  isPremium: boolean
  features: Feature[]
}

interface PermissionsContextValue {
  isAuthenticated: boolean
  isPremium: boolean
  accessibleFeatures: Feature[]
  canAccess: (feature: Feature) => boolean
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
    return { isAuthenticated: false, isPremium: false, features: FREE_FEATURES }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('membership, membership_expires_at')
    .eq('id', session.user.id)
    .single()

  if (error || !profile) {
    return { isAuthenticated: true, isPremium: false, features: FREE_FEATURES }
  }

  let userIsPremium = false
  if (profile.membership === 'premium') {
    if (profile.membership_expires_at) {
      const expiresAt = new Date(profile.membership_expires_at)
      userIsPremium = expiresAt.getTime() > Date.now()
    } else {
      userIsPremium = true
    }
  }

  return {
    isAuthenticated: true,
    isPremium: userIsPremium,
    features: userIsPremium ? [...FREE_FEATURES, ...PREMIUM_FEATURES] : FREE_FEATURES
  }
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig()

  const { data, error, isLoading } = useSWR('user-permissions', fetchPermissions, {
    revalidateOnFocus: false, // TẮT auto check của SWR để tránh xung đột
    revalidateOnReconnect: false,
    dedupingInterval: 60000, 
    // Dữ liệu mặc định: Coi như chưa đăng nhập -> UI sẽ render ngay lập tức (không treo)
    // Sau khi fetch xong (vài ms sau), UI sẽ update lại đúng trạng thái
    fallbackData: { 
      isAuthenticated: false, 
      isPremium: false, 
      features: FREE_FEATURES 
    } 
  })

  // --- OPTIMIZED: Soft refresh instead of hard reload ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem('last_background_time', Date.now().toString())
      } else if (document.visibilityState === 'visible') {
        const lastTime = sessionStorage.getItem('last_background_time')
        if (lastTime) {
          const timeAway = Date.now() - parseInt(lastTime)
          // OPTIMIZED: Removed hard reload - use soft refresh for better UX
          // Only refresh permissions data, no full page reload
          if (timeAway > 60 * 1000) {
            console.log('⏳ Away > 60s. Soft refreshing permissions...')
            mutate('user-permissions')
          } else if (timeAway > 30 * 1000) {
            // Soft refresh even after 30s for fresher data
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

  const value = useMemo(() => ({
    isAuthenticated: data?.isAuthenticated ?? false,
    isPremium: data?.isPremium ?? false,
    accessibleFeatures: data?.features ?? FREE_FEATURES,
    canAccess,
    isLoading, // SWR tự quản lý
    isError: !!error,
    refresh
  }), [data, isLoading, error])

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
      isPremium: false,
      accessibleFeatures: FREE_FEATURES,
      canAccess: () => false,
      isLoading: true,
      isError: false,
      refresh: async () => {}
    }
  }
  return context
}
