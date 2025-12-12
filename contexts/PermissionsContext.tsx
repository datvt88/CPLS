'use client'

import { createContext, useContext, useMemo, useEffect, useRef, useState, useCallback } from 'react'
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

// Cache để giữ trạng thái auth cuối cùng (tránh flash logout)
let lastKnownAuthState: PermissionData | null = null

// Helper: Retry với exponential backoff
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 500
): Promise<T> => {
  let lastError: Error | null = null
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries) {
        const delay = initialDelay * Math.pow(2, i)
        console.log(`🔄 [PermissionsContext] Retry ${i + 1}/${maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

// --- FETCHER with timeout and retry ---
const fetchPermissions = async (): Promise<PermissionData> => {
  try {
    // Sử dụng retry logic cho session check
    const sessionResult = await retryWithBackoff(async () => {
      const result = await authService.getSession()
      // Nếu có lỗi nhưng có lastKnownAuthState đã auth, throw để retry
      if (result.error && lastKnownAuthState?.isAuthenticated) {
        const errorMsg = result.error instanceof Error ? result.error.message : 'Unknown error'
        throw new Error(`Session check failed (${errorMsg}), will retry...`)
      }
      return result
    }, 2, 500)

    const { session, error: sessionError } = sessionResult

    if (sessionError || !session?.user) {
      // Chỉ return DEFAULT nếu THỰC SỰ không có session
      // Kiểm tra thêm một lần với Supabase trực tiếp
      const { data: directSession } = await supabase.auth.getSession()
      if (!directSession.session?.user) {
        lastKnownAuthState = DEFAULT_PERMISSIONS
        return DEFAULT_PERMISSIONS
      }
      // Có session từ Supabase trực tiếp, dùng nó
      const user = directSession.session.user
      console.log('🔄 [PermissionsContext] Recovered session from Supabase directly')
      
      // Tiếp tục fetch profile với user này
      return await fetchProfileData(user.id)
    }

    return await fetchProfileData(session.user.id)
  } catch (error) {
    console.error('❌ [PermissionsContext] Fetch error:', error)
    // Nếu có lỗi và đã biết user đang authenticated, giữ state cũ
    if (lastKnownAuthState?.isAuthenticated) {
      console.warn('⚠️ [PermissionsContext] Using cached auth state due to error')
      return lastKnownAuthState
    }
    return DEFAULT_PERMISSIONS
  }
}

// Helper function để fetch profile data
const fetchProfileData = async (userId: string): Promise<PermissionData> => {
  try {
    // Fetch profile with timeout (tăng lên 8s)
    const profilePromise = supabase
      .from('profiles')
      .select('membership, membership_expires_at, role')
      .eq('id', userId)
      .single()

    // Race with timeout
    const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
    )

    const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise])

    if (error || !profile) {
      const result: PermissionData = {
        isAuthenticated: true,
        isPremium: false,
        features: FREE_FEATURES,
        role: 'user',
        userId: userId
      }
      lastKnownAuthState = result
      return result
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

    const result: PermissionData = {
      isAuthenticated: true,
      isPremium: userIsPremium,
      features: userIsPremium ? [...FREE_FEATURES, ...PREMIUM_FEATURES] : FREE_FEATURES,
      role: userRole,
      userId: userId
    }
    
    // Cập nhật cache
    lastKnownAuthState = result
    return result
  } catch (error) {
    console.error('❌ [PermissionsContext] Profile fetch error:', error)
    // Trả về authenticated state với default permissions
    const result: PermissionData = {
      isAuthenticated: true,
      isPremium: false,
      features: FREE_FEATURES,
      role: 'user',
      userId: userId
    }
    lastKnownAuthState = result
    return result
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
  // Thêm debounce và kiểm tra session trước khi mutate
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Debounce để tránh multiple calls
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        
        debounceTimer = setTimeout(async () => {
          console.log('👁️ [PermissionsContext] App visible - checking session...')
          
          // Kiểm tra session trực tiếp trước khi mutate
          // để tránh trường hợp false logout
          try {
            const { data: sessionData } = await supabase.auth.getSession()
            
            if (sessionData.session?.user) {
              // Có session, an toàn để refresh permissions
              console.log('✅ [PermissionsContext] Session valid, refreshing permissions...')
              mutate('user-permissions')
            } else if (lastKnownAuthState?.isAuthenticated) {
              // Không có session nhưng trước đó đã auth -> có thể cần refresh token
              console.log('🔄 [PermissionsContext] Session expired, attempting refresh...')
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
              
              if (refreshData.session && !refreshError) {
                console.log('✅ [PermissionsContext] Token refreshed successfully')
                mutate('user-permissions')
              } else {
                // Thực sự không có session nữa
                console.log('⚠️ [PermissionsContext] Session truly expired')
                lastKnownAuthState = null
                mutate('user-permissions')
              }
            }
          } catch (error) {
            console.error('❌ [PermissionsContext] Visibility change error:', error)
            // Không mutate khi có lỗi để giữ state hiện tại
          }
        }, 300) // 300ms debounce
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
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
