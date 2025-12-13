'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'
import { supabase } from '@/lib/supabaseClient'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Require premium membership */
  requirePremium?: boolean
  /** @deprecated Use requirePremium instead */
  requireVIP?: boolean
  /** Require admin or mod role */
  requireAdmin?: boolean
  /** Custom redirect URL when not authorized (default: /login for auth, /dashboard for admin) */
  redirectTo?: string
}

// Grace period to wait for auth to stabilize after initial load (reduced from 1.5s to 1s)
const AUTH_STABILIZATION_DELAY = 1000
// Maximum time to wait for verification before forcing completion
const MAX_VERIFICATION_TIMEOUT = 5000
// Time to wait for state to propagate after refresh
const STATE_PROPAGATION_DELAY = 100

/**
 * Unified ProtectedRoute Component
 * 
 * Handles:
 * - Authentication protection (redirects to /login if not authenticated)
 * - Premium/VIP access (redirects to /upgrade if not premium)
 * - Admin/Mod access (redirects to /dashboard if not admin/mod)
 */
export default function ProtectedRoute({
  children,
  requirePremium = false,
  requireVIP = false,
  requireAdmin = false,
  redirectTo
}: ProtectedRouteProps) {
  const router = useRouter()
  const hasRedirected = useRef(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const safetyTimeoutRef = useRef<NodeJS.Timeout>()
  const mountedRef = useRef(true)
  const hasVerifiedRef = useRef(false)

  const {
    isAuthenticated,
    isPremium,
    hasAdminAccess,
    isLoading,
    isError,
    refresh
  } = usePermissions()

  const needsPremium = requirePremium || requireVIP

  // Safety timeout: ensure isVerifying becomes false eventually
  useEffect(() => {
    safetyTimeoutRef.current = setTimeout(() => {
      // Only force completion if verification hasn't completed normally
      if (mountedRef.current && !hasVerifiedRef.current) {
        console.warn('⏱️ [ProtectedRoute] Safety timeout - forcing verification complete')
        hasVerifiedRef.current = true
        setIsVerifying(false)
      }
    }, MAX_VERIFICATION_TIMEOUT)
    
    return () => {
      mountedRef.current = false
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current)
      }
    }
  }, [])

  // When loading completes, verify auth state
  useEffect(() => {
    // If already verified, don't re-verify
    if (hasVerifiedRef.current) {
      return
    }
    
    // If context is still loading, wait for it
    if (isLoading) {
      return
    }
    
    let isCancelled = false
    
    // Context is done loading - now check auth
    const verifyAuth = async () => {
      // If authenticated, we're done
      if (isAuthenticated) {
        console.log('✅ [ProtectedRoute] User authenticated via context')
        hasVerifiedRef.current = true
        setIsVerifying(false)
        return
      }
      
      // Not authenticated according to context - double-check with Supabase
      // Wait a short period for auth to stabilize
      await new Promise(resolve => setTimeout(resolve, AUTH_STABILIZATION_DELAY))
      
      if (isCancelled || !mountedRef.current) return
      
      // Double-check with Supabase directly
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (isCancelled || !mountedRef.current) return
        
        if (session?.user) {
          console.log('✅ [ProtectedRoute] Session verified directly with Supabase')
          // Wait for refresh to complete before setting verified
          await refresh()
          // Give a short delay for state to propagate
          await new Promise(resolve => setTimeout(resolve, STATE_PROPAGATION_DELAY))
        } else {
          console.log('📭 [ProtectedRoute] No session found')
        }
      } catch (error) {
        console.error('❌ [ProtectedRoute] Error verifying session:', error)
      } finally {
        if (!isCancelled && mountedRef.current) {
          hasVerifiedRef.current = true
          setIsVerifying(false)
        }
      }
    }
    
    verifyAuth()
    
    return () => {
      isCancelled = true
    }
  }, [isAuthenticated, isLoading, refresh])

  // Handle redirects
  useEffect(() => {
    if (hasRedirected.current) return
    if (isLoading || isVerifying) return

    // Not authenticated -> redirect to login
    if (!isAuthenticated) {
      console.log('🔒 [ProtectedRoute] Not authenticated, redirecting to login')
      hasRedirected.current = true
      router.push(redirectTo || '/auth/login')
      return
    }

    // Authenticated but needs admin access
    if (requireAdmin && !hasAdminAccess) {
      console.log('❌ [ProtectedRoute] Access denied: user is not admin/mod')
      hasRedirected.current = true
      router.push(redirectTo || '/dashboard')
      return
    }

    // Authenticated but needs premium
    if (needsPremium && !isPremium) {
      hasRedirected.current = true
      router.push(redirectTo || '/upgrade')
      return
    }
  }, [isLoading, isVerifying, isAuthenticated, isPremium, needsPremium, requireAdmin, hasAdminAccess, router, redirectTo])

  // Reset on unmount
  useEffect(() => {
    return () => {
      hasRedirected.current = false
    }
  }, [])

  // --- ERROR STATE ---
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="text-center p-6 bg-[#1E1E1E] rounded-xl border border-red-500/30 max-w-sm w-full mx-4 shadow-2xl">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Lỗi kết nối</h3>
          <p className="text-gray-400 text-sm mb-6">
            Không thể kiểm tra quyền truy cập. Vui lòng kiểm tra mạng của bạn.
          </p>
          <button
            onClick={() => refresh()}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-red-500/20"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  // --- LOADING STATE ---
  if (isLoading || isVerifying) {
    const loadingMessage = requireAdmin 
      ? 'Đang kiểm tra quyền quản trị...' 
      : 'Đang kiểm tra quyền...'
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#2C2C2C] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400 font-medium animate-pulse">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  // --- CHECK AUTHORIZATION ---
  if (!isAuthenticated) {
    return null // Waiting for redirect
  }

  if (requireAdmin && !hasAdminAccess) {
    return null // Waiting for redirect
  }

  if (needsPremium && !isPremium) {
    return null // Waiting for redirect
  }

  // --- AUTHORIZED ---
  return (
    <div className="animate-[fadeIn_0.2s_ease-out]">
      {children}
    </div>
  )
}
