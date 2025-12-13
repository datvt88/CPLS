'use client'

import { usePermissions } from '@/contexts/PermissionsContext'
import { useAuth as useAuthContext } from '@/contexts/AuthContext'

interface UseSessionReturn {
  userId: string | null
  loading: boolean
  isAuthenticated: boolean
  refresh: () => Promise<void>
}

/**
 * Custom hook to get current session status
 *
 * Uses PermissionsContext to avoid separate session fetches.
 * If you need the full session/user object from Supabase,
 * use supabase.auth.getSession() directly in your component.
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
 * 
 * Uses AuthContext for full authentication state including user object.
 * For permissions (premium, admin), use usePermissions() instead.
 */
export function useAuth() {
  const context = useAuthContext()
  return {
    isAuthenticated: context.isAuthenticated,
    loading: context.isLoading,
    user: context.user,
    session: context.session,
  }
}
