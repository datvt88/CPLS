'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const IS_DEV = process.env.NODE_ENV === 'development'
const AUTH_TIMEOUT = 10000 // Increased to 10 seconds for better UX

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

  const handleTimeout = useCallback(() => {
    if (!isMountedRef.current || !loading) return

    if (IS_DEV) {
      console.warn('⏱️ ProtectedRoute: Auth check timeout')
    }

    if (hasValidSession) {
      if (IS_DEV) console.log('✅ Granting access on timeout with valid session')
      setAllowed(true)
      setLoading(false)
    } else {
      if (IS_DEV) console.warn('❌ Redirecting to login - no session')
      setLoading(false)
      router.push('/login')
    }
  }, [loading, hasValidSession, router])

  useEffect(() => {
    isMountedRef.current = true

    // Safety timeout with longer duration
    timeoutRef.current = setTimeout(handleTimeout, AUTH_TIMEOUT)

    const checkAuth = async () => {
      try {
        if (IS_DEV) console.log('🔍 Checking auth...')

        // Step 1: Check session
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMountedRef.current) return

        if (!session) {
          if (IS_DEV) console.log('❌ No session found')
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setHasValidSession(false)
          setLoading(false)
          router.push('/login')
          return
        }

        if (IS_DEV) console.log('✅ Session found')
        setHasValidSession(true)

        // Step 2: If no premium required, grant access immediately
        if (!needsPremium) {
          if (IS_DEV) console.log('✅ Access granted (no premium required)')
          if (isMountedRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setAllowed(true)
            setLoading(false)
          }
          return
        }

        // Step 3: Premium required - check membership with optimized retry
        if (IS_DEV) console.log('🔒 Checking premium membership...')

        const checkProfile = async (retryCount = 0): Promise<any> => {
          const { data, error } = await supabase
            .from('profiles')
            .select('membership, membership_expires_at')
            .eq('id', session.user.id)
            .maybeSingle() // Use maybeSingle instead of single to avoid errors

          // Profile found
          if (data && !error) return data

          // Retry for new users (profile might not be created yet)
          if (error?.code === 'PGRST116' && retryCount < 1) {
            if (IS_DEV) console.log('⏳ Profile not found, retrying...')
            await new Promise(resolve => setTimeout(resolve, 1500))
            return checkProfile(retryCount + 1)
          }

          // Other errors
          if (error) {
            if (IS_DEV) console.error('❌ Profile error:', error)
            throw error
          }

          return null
        }

        const profile = await checkProfile()

        if (!isMountedRef.current) return

        if (!profile) {
          if (IS_DEV) console.log('⚠️ No profile found')
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setLoading(false)
          router.push('/upgrade')
          return
        }

        // Step 4: Check membership status
        const isPremium = profile.membership === 'premium'
        const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null
        const isExpired = expiresAt && expiresAt < new Date()

        if (isPremium && !isExpired) {
          if (IS_DEV) {
            const expiryText = expiresAt ? `until ${expiresAt.toLocaleDateString()}` : 'lifetime'
            console.log(`✅ Premium user (${expiryText})`)
          }
          if (isMountedRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setAllowed(true)
            setLoading(false)
          }
        } else {
          if (IS_DEV) console.log('⚠️ Premium required but not available')
          if (isMountedRef.current) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setLoading(false)
            router.push('/upgrade')
          }
        }

      } catch (error) {
        if (IS_DEV) console.error('❌ Auth check error:', error)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsPremium]) // Removed router from deps to prevent unnecessary re-renders

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
