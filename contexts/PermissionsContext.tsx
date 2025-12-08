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
    // Nếu không phải silent check, bật loading để UI biết đang xử lý
    if (!isSilent) setIsLoading(true)
    
    // Reset lỗi chỉ khi reload thủ công (không reset khi silent check để tránh nháy lỗi)
    if (!isSilent) setIsError(false)

    try {
      // 1. Gọi authService
      const { session, error: sessionError } = await authService.getSession()

      if (!mounted.current) return

      // --- SỬA LOGIC TIMEOUT Ở ĐÂY ---
      // Nếu lỗi Timeout:
      // - Nếu là Silent Check: Bỏ qua, giữ nguyên state cũ (Return luôn)
      // - Nếu là Load lần đầu: Phải throw error xuống dưới để tắt loading và hiện màn hình lỗi
      if (sessionError && (sessionError as any).message === 'Request timeout') {
        console.warn('⚠️ [Permissions] Network timeout')
        if (isSilent) {
           return // Giữ nguyên trải nghiệm, không làm gì cả
        } else {
           throw sessionError // Ném lỗi để hiện màn hình "Thử lại"
        }
      }

      // Xử lý không có session (Chưa đăng nhập hoặc lỗi khác)
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
      // Chỉ hiện lỗi khi load lần đầu, để user có nút bấm thử lại
      if (!isSilent) setIsError(true)
    } finally {
      // Luôn tắt loading trong mọi trường hợp (trừ khi silent check thì vốn dĩ ko bật)
      if (mounted.current && !isSilent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    
    // Load lần đầu (có loading)
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

    // Tự động check lại khi User quay lại Tab (Silent Mode)
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
