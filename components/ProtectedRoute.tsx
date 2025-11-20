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
          router.push('/login')
          return
        }

        console.log('✅ Session found:', session.user.email)

        // If premium is required, check membership
        if (needsPremium) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('membership, membership_expires_at')
            .eq('id', session.user.id)
            .single()

          // Handle case where profile doesn't exist yet (new Google OAuth user)
          if (error) {
            console.error('Profile query error:', error)

            // If profile doesn't exist, allow access but user will be treated as free
            // The profile will be created by AuthListener + DB trigger
            if (error.code === 'PGRST116') {
              console.log('⚠️ Profile not found yet, waiting for creation...')

              // Wait a bit for trigger to create profile
              await new Promise(resolve => setTimeout(resolve, 1000))

              // Try one more time
              const { data: retryProfile } = await supabase
                .from('profiles')
                .select('membership, membership_expires_at')
                .eq('id', session.user.id)
                .single()

              if (!retryProfile || retryProfile.membership !== 'premium') {
                // No premium, redirect to upgrade
                router.push('/upgrade')
                return
              }
            } else {
              // Other errors, redirect to login
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
                setAllowed(true)
              } else {
                // Expired premium membership
                console.log('⚠️ Premium membership expired')
                router.push('/upgrade')
              }
            } else {
              // No expiration date means lifetime premium
              setAllowed(true)
            }
          } else {
            // Free user trying to access premium content
            console.log('⚠️ Free user, premium required')
            router.push('/upgrade')
          }
        } else {
          // No premium required, allow access
          console.log('✅ Access allowed')
          setAllowed(true)
        }
      } catch (error) {
        console.error('❌ Auth check error:', error)
        router.push('/login')
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
