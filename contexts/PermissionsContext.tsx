'use client'

import { createContext, useContext, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { Feature, PREMIUM_FEATURES, FREE_FEATURES } from '@/lib/permissions'
import useSWR, { useSWRConfig } from 'swr' // Import SWR

interface PermissionsContextValue {
  isPremium: boolean
  accessibleFeatures: Feature[]
  canAccess: (feature: Feature) => boolean
  isLoading: boolean
  isError: boolean
  refresh: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextValue | undefined>(undefined)

// --- FETCHER: Hàm lấy dữ liệu cho SWR ---
const fetchPermissions = async () => {
  // 1. Lấy Session
  const { session, error: sessionError } = await authService.getSession()
  
  if (sessionError || !session?.user) {
    return { isPremium: false, features: FREE_FEATURES }
  }

  // 2. Lấy Profile từ DB
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('membership, membership_expires_at')
    .eq('id', session.user.id)
    .single()

  if (error || !profile) {
    // Có lỗi lấy profile nhưng vẫn cho user dùng Free
    return { isPremium: false, features: FREE_FEATURES }
  }

  // 3. Tính toán Premium
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

  // 👇 SWR HOOK MAGIC:
  // - Key: 'user-permissions' (định danh cache)
  // - Fetcher: hàm logic ở trên
  // - Options: Tự động revalidate khi focus, reconnect
  const { data, error, isLoading } = useSWR('user-permissions', fetchPermissions, {
    revalidateOnFocus: true, // Tự động check khi quay lại tab
    revalidateOnReconnect: true, // Tự động check khi có mạng lại
    refreshInterval: 0, // Không cần polling định kỳ
    dedupingInterval: 5000, // Trong 5s không gọi trùng
    fallbackData: { isPremium: false, features: FREE_FEATURES } // Giá trị mặc định
  })

  // Hàm helper
  const canAccess = (feature: Feature): boolean => {
    return data?.features.includes(feature) ?? false
  }

  const refresh = async () => {
    await mutate('user-permissions') // Gọi hàm này để ép reload
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
