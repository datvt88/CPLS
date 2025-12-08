'use client'

import { createContext, useContext, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES } from '@/lib/permissions'
import useSWR, { useSWRConfig } from 'swr' 

interface PermissionsContextValue {
  isPremium: boolean
  accessibleFeatures: Feature[]
  canAccess: (feature: Feature) => boolean
  isLoading: boolean
  isError: boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

// --- FETCHER FUNCTION ---
const fetchPermissions = async () => {
  const { session, error: sessionError } = await authService.getSession()
  
  if (sessionError || !session?.user) {
    return { isPremium: false, features: FREE_FEATURES }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('membership, membership_expires_at')
    .eq('id', session.user.id)
    .single()

  if (error || !profile) {
    return { isPremium: false, features: FREE_FEATURES }
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
    isPremium: userIsPremium,
    features: userIsPremium ? [...FREE_FEATURES, ...PREMIUM_FEATURES] : FREE_FEATURES
  }
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { mutate } = useSWRConfig()

  // 1. CẤU HÌNH SWR: TẮT HẾT TỰ ĐỘNG
  const { data, error, isLoading } = useSWR('user-permissions', fetchPermissions, {
    revalidateOnFocus: false, // TẮT: Không tự check khi focus tab
    revalidateOnReconnect: false, // TẮT: Không tự check khi có mạng lại
    refreshInterval: 0, // TẮT: Không tự refresh định kỳ
    shouldRetryOnError: false,
    fallbackData: { isPremium: false, features: FREE_FEATURES } 
  })

  // 2. LOGIC KIỂM TRA THỜI GIAN RỜI ĐI
  useEffect(() => {
    const handleVisibilityChange = () => {
      // A. Khi người dùng ẩn app (Home, chuyển tab)
      if (document.visibilityState === 'hidden') {
        // Lưu thời điểm rời đi
        sessionStorage.setItem('last_background_time', Date.now().toString())
      } 
      // B. Khi người dùng quay lại
      else if (document.visibilityState === 'visible') {
        const lastTime = sessionStorage.getItem('last_background_time')
        
        if (lastTime) {
          const timeAway = Date.now() - parseInt(lastTime)
          const RELOAD_THRESHOLD = 60 * 1000 // 60 giây

          if (timeAway > RELOAD_THRESHOLD) {
            // Trường hợp 1: Rời đi > 60s -> Reload trang
            console.log(`⏳ Đã rời đi ${timeAway/1000}s (>60s). Tải lại trang...`)
            window.location.reload()
          } else {
            // Trường hợp 2: Rời đi < 60s -> KHÔNG LÀM GÌ CẢ
            // Giữ nguyên data cũ của SWR, không gọi API, không check quyền.
            console.log(`⚡ Quay lại nhanh (${timeAway/1000}s). Giữ nguyên trạng thái.`)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // Dependency array rỗng để chỉ chạy logic này, không phụ thuộc SWR

  const canAccess = (feature: Feature): boolean => {
    return data?.features.includes(feature) ?? false
  }

  const refresh = async () => {
    await mutate('user-permissions')
  }

  const value = useMemo(() => ({
    isPremium: data?.isPremium ?? false,
    accessibleFeatures: data?.features ?? FREE_FEATURES,
    canAccess,
    isLoading, 
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
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }
  return context
}
