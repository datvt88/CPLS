// contexts/PermissionsContext.tsx
'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
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
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false)
  const [accessibleFeatures, setAccessibleFeatures] = useState<Feature[]>(FREE_FEATURES)
  const [isLoading, setIsLoading] = useState(true)

  const loadPermissions = useCallback(async () => {
    try {
      // 1. Gọi authService (đã có cơ chế cache và try-catch an toàn)
      const { session, error: sessionError } = await authService.getSession()

      if (sessionError || !session?.user) {
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        return
      }

      // 2. Lấy thông tin Profile Membership từ DB
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('membership, membership_expires_at')
        .eq('id', session.user.id)
        .single<Profile>()

      if (error || !profile) {
        // Nếu lỗi lấy profile, fallback về Free để không crash app
        console.warn('⚠️ [Permissions] Profile not found, defaulting to Free')
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        return
      }

      // 3. Logic kiểm tra hạn Premium
      let userIsPremium = false
      if (profile.membership === 'premium') {
        if (profile.membership_expires_at) {
          const expiresAt = new Date(profile.membership_expires_at)
          userIsPremium = expiresAt.getTime() > Date.now()
        } else {
          userIsPremium = true // Lifetime
        }
      }

      // 4. Cập nhật State
      setIsPremium(userIsPremium)
      setAccessibleFeatures(userIsPremium ? [...FREE_FEATURES, ...PREMIUM_FEATURES] : FREE_FEATURES)

    } catch (error) {
      console.error('❌ [Permissions] Error:', error)
      setIsPremium(false)
      setAccessibleFeatures(FREE_FEATURES)
    } finally {
      // Luôn tắt loading dù thành công hay thất bại
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPermissions()

    // Lắng nghe sự kiện từ authService
    const { data: authListener } = authService.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadPermissions()
      } else if (event === 'SIGNED_OUT') {
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        setIsLoading(false)
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

export function usePermissions() {
  const context = useContext(PermissionsContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }
  return context
}
