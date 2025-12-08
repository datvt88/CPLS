'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { usePermissions } from '@/contexts/PermissionsContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requirePremium?: boolean
  /** @deprecated Use requirePremium instead */
  requireVIP?: boolean
}

/**
 * Optimized ProtectedRoute using PermissionsContext
 * Reduces RPC calls by caching permissions in context
 */
export default function ProtectedRouteOptimized({
  children,
  requirePremium = false,
  requireVIP = false
}: ProtectedRouteProps) {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(true)

  const { isPremium, isLoading: permissionsLoading } = usePermissions()
  const needsPremium = requirePremium || requireVIP

  useEffect(() => {
    isMountedRef.current = true

    // Safety timeout: force stop loading after 5 seconds
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn('⏱️ ProtectedRoute: Auth check timeout after 5s')

        setLoading(false)
        router.push('/login')
      }
    }, 5000)

    const checkAuth = async () => {
      try {
        console.log('🔍 ProtectedRoute: Checking auth...')

        // Step 1: Check session with cached authService (much faster!)
        const { session } = await authService.getSession()

        if (!isMountedRef.current) return

        if (!session) {
          console.log('❌ ProtectedRoute: No session found')
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setLoading(false)
          router.push('/login')
          return
        }

        console.log('✅ ProtectedRoute: Session found')

        // Step 2: If no premium required, grant access immediately
        if (!needsPremium) {
          console.log('✅ Access granted (no premium required)')
          if (isMountedRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setAllowed(true)
            setLoading(false)
          }
          return
        }

        // Step 3: Premium required - use cached permissions from context
        if (permissionsLoading) {
          console.log('⏳ Waiting for permissions to load...')
          return // Wait for next effect cycle
        }

        if (isPremium) {
          console.log('✅ Premium user - access granted')
          if (isMountedRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setAllowed(true)
            setLoading(false)
          }
        } else {
          console.log('⚠️ Free user, premium required - redirecting to upgrade')
          if (isMountedRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setLoading(false)
            router.push('/upgrade')
          }
        }
      } catch (error) {
        console.error('❌ Auth check error:', error)
        if (isMountedRef.current) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setLoading(false)
          router.push('/login')
        }
      }
    }

    checkAuth()

    // Cleanup
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [needsPremium, router, isPremium, permissionsLoading])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[--bg]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
