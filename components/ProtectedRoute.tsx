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

        if (needsPremium) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('membership, membership_expires_at')
            .eq('id', session.user.id)
            .single()

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
                router.push('/upgrade')
              }
            } else {
              // No expiration date means lifetime premium
              setAllowed(true)
            }
          } else {
            // Free user trying to access premium content
            router.push('/upgrade')
          }
        } else {
          setAllowed(true)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [needsPremium, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
