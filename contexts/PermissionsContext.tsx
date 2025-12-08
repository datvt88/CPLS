'use client'

import { createContext, useContext, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES } from '@/lib/permissions'
import useSWR, { useSWRConfig } from 'swr' 

// Interface cho dữ liệu trả về từ Fetcher
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

// --- FETCHER FUNCTION (Logic lấy dữ liệu) ---
const fetchPermissions = async (): Promise<PermissionData> => {
  // 1. Lấy Session (Có cache & timeout từ authService)
  const { session, error: sessionError } = await authService.getSession()
  
  // Nếu lỗi hoặc không có user -> Chưa đăng nhập
  if (sessionError || !session?.user) {
    return { 
      isAuthenticated: false, 
      isPremium: false, 
      features: FREE_FEATURES 
    }
  }

  // 2. Lấy Profile từ DB
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('membership, membership_expires_at')
    .eq('id', session.user.id)
    .single()

  // Nếu có lỗi lấy profile -> Vẫn coi là đã đăng nhập, nhưng quyền Free
  if (error || !profile) {
    return { 
      isAuthenticated: true, 
      isPremium: false, 
      features: FREE_FEATURES 
    }
  }

  // 3. Tính toán quyền Premium
  let userIsPremium = false
  if (profile.membership === 'premium') {
    if (profile.membership_expires_at) {
      const expiresAt = new Date(profile.membership_expires_at)
      userIsPremium = expiresAt.getTime() > Date.now()
    } else {
      userIsPremium = true // Vĩnh viễn
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

  // 4. SWR HOOK (Quản lý State & Cache)
  const { data, error, isLoading } = useSWR('user-permissions', fetchPermissions, {
    // Tắt tự động kiểm tra khi chuyển tab -> User quay lại không bị loading/check lại
    revalidateOnFocus: false, 
    revalidateOnReconnect: false,
    
    // Giữ cache trong 5 phút không gọi lại
    dedupingInterval: 5 * 60 * 1000, 
    
    // Dữ liệu mặc định ban đầu
    fallbackData: { 
      isAuthenticated: false, 
      isPremium: false, 
      features: FREE_FEATURES 
    } 
  })

  // Helper Functions
  const canAccess = (feature: Feature): boolean => {
    return data?.features.includes(feature) ?? false
  }

  const refresh = async () => {
    // Hàm này để gọi thủ công khi cần (VD: sau khi thanh toán thành công)
    await mutate('user-permissions') 
  }

  // Memoize giá trị context để tối ưu render
  const value = useMemo(() => ({
    isAuthenticated: data?.isAuthenticated ?? false,
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

// 👇 ĐOẠN ĐÃ SỬA: Thêm fallback an toàn khi không tìm thấy Provider
export function usePermissions() {
  const context = useContext(PermissionsContext)
  
  if (context === undefined) {
    // Trả về giá trị mặc định thay vì ném lỗi, giúp Build/Prerender không bị chết
    return {
      isAuthenticated: false,
      isPremium: false,
      accessibleFeatures: FREE_FEATURES,
      canAccess: () => false,
      isLoading: true, // Giả lập đang loading để UI không crash
      isError: false,
      refresh: async () => {}
    }
  }
  
  return context
}
