'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface AdminRouteProps {
  children: React.ReactNode
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout>()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    // Safety timeout: force stop loading after 5 seconds
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loading) {
        console.warn('⏱️ Admin check timeout, redirecting to dashboard...')
        setLoading(false)
        router.push('/dashboard')
      }
    }, 5000)

    const checkAdminAccess = async () => {
      try {
        // Step 1: Check session
        const { data: { session } } = await supabase.auth.getSession()

        if (!isMountedRef.current) return

        if (!session) {
          console.log('❌ No session, redirecting to login')
          setLoading(false)
          router.push('/login')
          return
        }

        console.log('✅ Session found:', session.user.email)

        // Step 2: Check user role with retry logic
        let profile = null
        let attempts = 0
        const maxAttempts = 2

        while (attempts < maxAttempts && !profile) {
          attempts++

          const { data, error } = await supabase
            .from('profiles')
            .select('role, full_name, email')
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
            setLoading(false)
            router.push('/dashboard')
            return
          }
        }

        if (!profile) {
          console.log('⚠️ Profile not found after retries, access denied')
          if (isMountedRef.current) {
            setLoading(false)
            router.push('/dashboard')
          }
          return
        }

        // Step 3: Check if user is admin or mod
        if (profile.role === 'admin' || profile.role === 'mod') {
          console.log('✅ Admin/Mod access granted:', profile.role, '-', profile.full_name || profile.email)
          if (isMountedRef.current) {
            setAllowed(true)
            setLoading(false)
          }
        } else {
          console.log('❌ Access denied: user role is', profile.role)
          if (isMountedRef.current) {
            setLoading(false)
            router.push('/dashboard')
          }
        }

      } catch (error) {
        console.error('❌ Admin access check error:', error)
        if (isMountedRef.current) {
          setLoading(false)
          router.push('/dashboard')
        }
      }
    }

    checkAdminAccess()

    // Cleanup
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [router, loading])

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
