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
    if (!isSilent) setIsLoading(true)
    setIsError(false)

    try {
      // 1. Lấy Session (Có cache từ authService)
      const { session, error: sessionError } = await authService.getSession()

      if (!mounted.current) return

      // Nếu lỗi mạng, giữ nguyên state cũ
      if (sessionError && (sessionError as any).message === 'Request timeout') {
        if (!isSilent) console.warn('⚠️ [Permissions] Network timeout - Keeping previous state')
        return 
      }

      // Nếu mất session -> Về Free
      if (sessionError || !session?.user) {
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        return
      }

      // 2. Lấy thông tin Profile Membership
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('membership, membership_expires_at')
        .eq('id', session.user.id)
        .single<Profile>()

      if (!mounted.current) return

      if (error || !profile) {
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
    
    // 1. Load lần đầu tiên khi F5 (BẮT BUỘC)
    loadPermissions(false)

    // 2. Chỉ lắng nghe sự kiện Auth quan trọng (Login/Logout)
    // KHÔNG lắng nghe focus/visibilitychange nữa -> Quay lại app sẽ không check lại
    const { data: authListener } = authService.onAuthStateChange((event) => {
      if (!mounted.current) return
      
      // Nếu user đăng nhập mới hoặc đăng xuất thì mới cập nhật
      if (event === 'SIGNED_IN') {
        loadPermissions(false) 
      } else if (event === 'SIGNED_OUT') {
        setIsPremium(false)
        setAccessibleFeatures(FREE_FEATURES)
        setIsLoading(false)
      }
      // Lưu ý: Bỏ qua 'TOKEN_REFRESHED' nếu bạn muốn "lì" nhất có thể
      // Nhưng nên giữ để nếu token hết hạn thực sự thì hệ thống tự xử lý ngầm
      else if (event === 'TOKEN_REFRESHED') {
         // loadPermissions(true) // Có thể comment dòng này nếu muốn tuyệt đối không check lại
      }
    })

    return () => {
      mounted.current = false
      authListener.subscription.unsubscribe()
      // Đã xóa các event listener focus/visibilitychange
    }
  }, [loadPermissions])

  // ... (Phần còn lại giữ nguyên)
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
