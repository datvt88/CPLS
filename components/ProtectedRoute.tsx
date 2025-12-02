'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

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
  const [loading, setLoading] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(true)

  const needsPremium = requirePremium || requireVIP

  useEffect(() => {
    isMountedRef.current = true

    // Safety timeout: force stop loading after 5 seconds
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn('⏱️ ProtectedRoute: Auth check timeout after 5s')
        console.warn('🔍 Debug:', { needsPremium, allowed, loading, hasValidSession })

        // If we have a valid session, grant access even on timeout
        if (hasValidSession) {
          console.log('✅ Timeout but session valid - granting access')
          setAllowed(true)
          setLoading(false)
        } else {
          // Only redirect to login if no valid session was ever detected
          console.warn('❌ Timeout with no session - redirecting to login')
          setLoading(false)
          router.push('/login')
        }
      }
    }, 5000) // Reduced to 5 seconds

    const checkAuth = async () => {
      try {
        console.log('🔍 ProtectedRoute: Checking auth...')

        // Step 1: Check session
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMountedRef.current) return

        if (!session) {
          console.log('❌ ProtectedRoute: No session found')
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setHasValidSession(false)
          setLoading(false)
          router.push('/login')
          return
        }

        console.log('✅ ProtectedRoute: Session found -', session.user.email?.slice(0, 20) + '...')

        // Mark that we have a valid session
        setHasValidSession(true)

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

        // Step 3: Premium required - check membership
        console.log('🔒 Checking premium membership...')

        let profile = null
        let attempts = 0
        const maxAttempts = 2

        // Retry logic for new users
        while (attempts < maxAttempts && !profile) {
          attempts++

          const { data, error } = await supabase
            .from('profiles')
            .select('membership, membership_expires_at')
            .eq('id', session.user.id)
            .single()

          if (!isMountedRef.current) return

          if (!error && data) {
            profile = data
            break
          }

          // If profile not found on first attempt, wait and retry
          if (error?.code === 'PGRST116' && attempts < maxAttempts) {
            console.log(`⏳ Profile not found (attempt ${attempts}/${maxAttempts}), retrying...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else if (error) {
            console.error('❌ Profile error:', error)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setLoading(false)
            router.push('/login')
            return
          }
        }

        if (!profile) {
          console.log('⚠️ Profile not found after retries')
          if (isMountedRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setLoading(false)
            router.push('/upgrade')
          }
          return
        }

        // Step 4: Check membership status
        if (profile.membership === 'premium') {
          // Check expiry
          if (profile.membership_expires_at) {
            const expiresAt = new Date(profile.membership_expires_at)
            const now = new Date()

            if (expiresAt > now) {
              console.log('✅ Premium user (active until', expiresAt.toLocaleDateString(), ')')
              if (isMountedRef.current) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current)
                setAllowed(true)
                setLoading(false)
              }
            } else {
              console.log('⚠️ Premium expired')
              if (isMountedRef.current) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current)
                setLoading(false)
                router.push('/upgrade')
              }
            }
          } else {
            // Lifetime premium
            console.log('✅ Premium user (lifetime)')
            if (isMountedRef.current) {
              if (timeoutRef.current) clearTimeout(timeoutRef.current)
              setAllowed(true)
              setLoading(false)
            }
          }
        } else {
          // Free user
          console.log('⚠️ Free user, premium required')
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
  }, [needsPremium, router])

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
