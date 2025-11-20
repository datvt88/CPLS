'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface AdminRouteProps {
  children: React.ReactNode
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          console.log('❌ No session found, redirecting to login')
          router.push('/login')
          return
        }

        console.log('✅ Session found:', session.user.email)

        // Check user's role
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, full_name, email')
          .eq('id', session.user.id)
          .single()

        if (error) {
          console.error('❌ Profile query error:', error)

          // If profile doesn't exist yet (new user)
          if (error.code === 'PGRST116') {
            console.log('⚠️ Profile not found, waiting for creation...')

            // Wait for trigger to create profile
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Try one more time
            const { data: retryProfile, error: retryError } = await supabase
              .from('profiles')
              .select('role, full_name, email')
              .eq('id', session.user.id)
              .single()

            if (retryError || !retryProfile) {
              console.log('⚠️ Profile still not found, access denied')
              router.push('/dashboard')
              return
            }

            // Check retry profile role
            if (retryProfile.role === 'admin' || retryProfile.role === 'mod') {
              console.log('✅ Admin/Mod access granted (after retry):', retryProfile.role)
              setAllowed(true)
            } else {
              console.log('❌ Access denied: user role is', retryProfile.role)
              router.push('/dashboard')
            }
          } else {
            // Other errors
            console.log('❌ Profile error, redirecting to dashboard')
            router.push('/dashboard')
          }
          return
        }

        // Check if user is admin or mod
        if (profile?.role === 'admin' || profile?.role === 'mod') {
          console.log('✅ Admin/Mod access granted:', profile.role, '-', profile.full_name || profile.email)
          setAllowed(true)
        } else {
          console.log('❌ Access denied: user role is', profile?.role)
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('❌ Admin access check error:', error)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    checkAdminAccess()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[--bg]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Đang kiểm tra quyền quản trị...</p>
        </div>
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  return <>{children}</>
}
