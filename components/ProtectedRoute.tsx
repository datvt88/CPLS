'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { useUserProfile } from '@/hooks/useUserProfile'

interface ProtectedRouteProps {
  children: React.ReactNode
  requirePremium?: boolean
  /** @deprecated Use requirePremium instead */
  requireVIP?: boolean
}

const AUTH_CHECK_TIMEOUT = 10000 // 10 seconds

export default function ProtectedRoute({
  children,
  requirePremium = false,
  requireVIP = false
}: ProtectedRouteProps){
  const [allowed, setAllowed] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { profile, loading: profileLoading, isPremium } = useUserProfile()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const needsPremium = requirePremium || requireVIP
  const loading = checkingSession || profileLoading

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        console.log('🔍 [ProtectedRoute] Checking auth...')

        // Set timeout to prevent infinite loading
        timeoutRef.current = setTimeout(() => {
          if (mounted && checkingSession) {
            console.error('⏱️ [ProtectedRoute] Auth check timeout')
            setError('Kiểm tra quyền truy cập quá lâu. Vui lòng thử lại.')
            setCheckingSession(false)
          }
        }, AUTH_CHECK_TIMEOUT)

        // Step 1: Check session with cached authService (much faster!)
        const { session, error: sessionError } = await Promise.race([
          authService.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Session check timeout')), AUTH_CHECK_TIMEOUT)
          )
        ])

        if (!mounted) return

        // Clear timeout on success
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        if (!session) {
          console.log('❌ [ProtectedRoute] No session found')
          setCheckingSession(false)
          router.push('/login')
          return
        }

        console.log('✅ [ProtectedRoute] Session found')
        setCheckingSession(false)

        // Wait for profile to load (handled by useUserProfile hook)
        // Hook will cache and return quickly on subsequent calls

      } catch (error: any) {
        console.error('❌ [ProtectedRoute] Auth check error:', error)
        if (mounted) {
          setCheckingSession(false)
          if (error.message === 'Session check timeout') {
            setError('Kiểm tra quyền truy cập quá lâu. Vui lòng thử lại.')
          } else {
            router.push('/login')
          }
        }
      }
    }

    checkAuth()

    return () => {
      mounted = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [router])

  // Check permissions after profile loads
  useEffect(() => {
    if (checkingSession || profileLoading) {
      return // Still loading
    }

    if (!profile) {
      console.log('⚠️ [ProtectedRoute] No profile found')
      router.push('/login')
      return
    }

    // If no premium required, grant access
    if (!needsPremium) {
      console.log('✅ [ProtectedRoute] Access granted (no premium required)')
      setAllowed(true)
      return
    }

    // Premium required - check membership
    if (isPremium) {
      console.log('✅ [ProtectedRoute] Premium user - access granted')
      setAllowed(true)
    } else {
      console.log('⚠️ [ProtectedRoute] Premium required but user is free')
      router.push('/upgrade')
    }

  }, [checkingSession, profileLoading, profile, isPremium, needsPremium, router])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[--bg]">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setCheckingSession(true)
              window.location.reload()
            }}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[--bg] transition-opacity duration-300">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 animate-pulse">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  // Smooth fade-in when content is allowed
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  )
}
