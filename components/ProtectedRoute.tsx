'use client'
import { useEffect, useState } from 'react'
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
  const router = useRouter()

  // Support both requirePremium and requireVIP for backward compatibility
  const needsPremium = requirePremium || requireVIP

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          console.log('❌ No session, redirecting to login')
          setLoading(false)
          router.push('/login')
          return
        }

        console.log('✅ Session found:', session.user.email)

        // If premium is NOT required, allow access immediately
        // (Profile will be created by AuthListener + DB trigger for new OAuth users)
        if (!needsPremium) {
          console.log('✅ Access allowed (no premium required)')
          setAllowed(true)
          setLoading(false)
          return
        }

        // Premium is required - check membership
        console.log('🔒 Premium required, checking membership...')

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('membership, membership_expires_at')
          .eq('id', session.user.id)
          .single()

        // Handle case where profile doesn't exist yet (new Google OAuth user)
        if (error) {
          console.error('Profile query error:', error)

          if (error.code === 'PGRST116') {
            console.log('⚠️ Profile not found yet, waiting for creation...')

            // Wait for trigger to create profile
            await new Promise(resolve => setTimeout(resolve, 1500))

            // Try one more time
            const { data: retryProfile, error: retryError } = await supabase
              .from('profiles')
              .select('membership, membership_expires_at')
              .eq('id', session.user.id)
              .single()

            if (retryError || !retryProfile) {
              console.log('⚠️ Profile still not found, redirecting to upgrade')
              setLoading(false)
              router.push('/upgrade')
              return
            }

            // Check retry profile membership
            if (retryProfile.membership !== 'premium') {
              console.log('⚠️ Free user, premium required')
              setLoading(false)
              router.push('/upgrade')
              return
            }

            // Premium user, allow access
            console.log('✅ Premium user (after retry)')
            setAllowed(true)
            setLoading(false)
            return
          } else {
            // Other errors, redirect to login
            console.log('❌ Profile error, redirecting to login')
            setLoading(false)
            router.push('/login')
            return
          }
        }

        // Check if user has premium membership
        if (profile?.membership === 'premium') {
          // Check if membership has expired
          if (profile.membership_expires_at) {
            const expiresAt = new Date(profile.membership_expires_at)
            const now = new Date()
            if (expiresAt > now) {
              console.log('✅ Premium user (active)')
              setAllowed(true)
            } else {
              // Expired premium membership
              console.log('⚠️ Premium membership expired')
              setLoading(false)
              router.push('/upgrade')
              return
            }
          } else {
            // No expiration date means lifetime premium
            console.log('✅ Premium user (lifetime)')
            setAllowed(true)
          }
        } else {
          // Free user trying to access premium content
          console.log('⚠️ Free user, premium required')
          setLoading(false)
          router.push('/upgrade')
          return
        }
      } catch (error) {
        console.error('❌ Auth check error:', error)
        setLoading(false)
        router.push('/login')
        return
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
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
