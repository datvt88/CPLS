// contexts/PermissionsContext.tsx
'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES } from '@/lib/permissions'

interface Profile {
  membership: string
  membership_expires_at: string | null
}

interface PermissionsContextValue {
  isPremium: boolean
  accessibleFeatures: Feature[]
  canAccess: (feature: Feature) => boolean
  isLoading: boolean
  isError: boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false)
  const [accessibleFeatures, setAccessibleFeatures] = useState<Feature[]>(FREE_FEATURES)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)
  
  const mounted = useRef(true)

  const loadPermissions = useCallback(async (isSilent = false) => {
    // Nếu là silent check (khi quay lại tab), không bật loading để tránh nháy màn hình
    if (!isSilent) setIsLoading(true)
    setIsError(false)

    try {
      // 1. Gọi authService
      const { session, error: sessionError } = await authService.getSession()

      if (!mounted.current) return

      // TRƯỜNG HỢP MẤT MẠNG / TIMEOUT: Giữ nguyên state cũ
      if (sessionError && (sessionError as any).message === 'Request timeout') {
        console.warn('⚠️ [Permissions] Network timeout - Keeping previous state')
        return 
      }

      if (sessionError || !session?.user) {
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        return
      }

      // 2. Lấy thông tin Membership
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('membership, membership_expires_at')
        .eq('id', session.user.id)
        .single<Profile>()

      if (!mounted.current) return

      if (error || !profile) {
        console.warn('⚠️ [Permissions] Profile fetch error, defaulting to Free')
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        return
      }

      // 3. Logic kiểm tra Premium
      let userIsPremium = false
      if (profile.membership === 'premium') {
        if (profile.membership_expires_at) {
          const expiresAt = new Date(profile.membership_expires_at)
          userIsPremium = expiresAt.getTime() > Date.now()
        } else {
          userIsPremium = true
        }
      }

      setIsPremium(userIsPremium)
      setAccessibleFeatures(userIsPremium ? [...FREE_FEATURES, ...PREMIUM_FEATURES] : FREE_FEATURES)

    } catch (error) {
      console.error('❌ [Permissions] Critical Error:', error)
      if (!isSilent) setIsError(true)
    } finally {
      if (mounted.current && !isSilent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    loadPermissions(false)

    const { data: authListener } = authService.onAuthStateChange((event) => {
      if (!mounted.current) return
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadPermissions(false)
      } else if (event === 'SIGNED_OUT') {
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        setIsLoading(false)
      }
    })

    // Tự động check lại khi User quay lại Tab
    const handleFocus = () => {
      console.log('👀 Window focused - Silent revalidating permissions...')
      loadPermissions(true)
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('visibilitychange', handleFocus)

    return () => {
      mounted.current = false
      authListener.subscription.unsubscribe()
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('visibilitychange', handleFocus)
    }
  }, [loadPermissions])

  const canAccess = useCallback((feature: Feature): boolean => {
    return accessibleFeatures.includes(feature)
  }, [accessibleFeatures])

  const refresh = useCallback(async () => {
    await loadPermissions(false)
  }, [loadPermissions])

  const value = useMemo(() => ({
    isPremium,
    accessibleFeatures,
    canAccess,
    isLoading,
    isError,
    refresh
  }), [isPremium, accessibleFeatures, canAccess, isLoading, isError, refresh])

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }
  return context
}
