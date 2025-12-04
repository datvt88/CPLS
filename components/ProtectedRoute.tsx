'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useUserProfile } from '@/hooks/useUserProfile'

interface ProtectedRouteProps {
  children: React.ReactNode
  requirePremium?: boolean
  /** @deprecated Use requirePremium instead */
  requireVIP?: boolean
}

export default function ProtectedRoute({
  children,
  requirePremium = false,
  requireVIP = false
}: ProtectedRouteProps){
  const [allowed, setAllowed] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const router = useRouter()
  const { profile, loading: profileLoading, isPremium } = useUserProfile()

  const needsPremium = requirePremium || requireVIP
  const loading = checkingSession || profileLoading

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        console.log('🔍 [ProtectedRoute] Checking auth...')

        // Step 1: Check session
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

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

      } catch (error) {
        console.error('❌ [ProtectedRoute] Auth check error:', error)
        if (mounted) {
          setCheckingSession(false)
          router.push('/login')
        }
      }
    }

    checkAuth()

    return () => {
      mounted = false
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
