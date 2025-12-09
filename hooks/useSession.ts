'use client'

import { usePermissions } from '@/contexts/PermissionsContext'

interface UseSessionReturn {
  userId: string | null
  loading: boolean
  isAuthenticated: boolean
  refresh: () => Promise<void>
}

/**
 * Custom hook to get current session status
 *
 * Sử dụng PermissionsContext để tránh fetch session riêng biệt.
 * Nếu cần truy cập session/user object đầy đủ từ Supabase,
 * sử dụng trực tiếp supabase.auth.getSession() trong component.
 */
export function useSession(): UseSessionReturn {
  const { userId, isLoading, isAuthenticated, refresh } = usePermissions()

  return {
    userId,
    loading: isLoading,
    isAuthenticated,
    refresh
  }
}

/**
 * Hook to check if user is authenticated
 */
export function useAuth() {
  const { isAuthenticated, isLoading } = usePermissions()
  return { isAuthenticated, loading: isLoading }
}
