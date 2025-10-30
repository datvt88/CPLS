'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ProtectedRouteProps } from '@/types'

export default function ProtectedRoute({ children, requireVIP = false }: ProtectedRouteProps) {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          router.push('/login')
          return
        }

        if (!requireVIP) {
          setAllowed(true)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('Error fetching profile:', profileError)
          router.push('/login')
          return
        }

        if (profile?.role === 'vip' || profile?.role === 'admin') {
          setAllowed(true)
        } else {
          router.push('/upgrade')
        }
      } catch (error) {
        console.error('Error in ProtectedRoute:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [requireVIP, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-muted">Loading...</p>
        </div>
      </div>
    )
  }

  if (!allowed) return null
  return <>{children}</>
}
