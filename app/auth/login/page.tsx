'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { AuthForm } from '@/components/AuthForm'
import { Suspense } from 'react'

// Timeout for session check (reduced to show form faster)
const SESSION_CHECK_TIMEOUT = 3000 // 3 seconds

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isChecking, setIsChecking] = useState(true)
  const hasRedirected = useRef(false)

  // Get destination URL (if any), or default to dashboard
  const nextUrl = searchParams.get('next') || '/dashboard'

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null

    const checkSession = async () => {
      try {
        // Set timeout to ensure form will show if session check takes too long
        timeoutId = setTimeout(() => {
          if (mounted && !hasRedirected.current) {
            console.log('⏰ [LoginPage] Session check timeout - showing login form')
            setIsChecking(false)
          }
        }, SESSION_CHECK_TIMEOUT)

        // 1. Check session with safe Timeout from authService
        const { session, error } = await authService.getSession()

        // Clear timeout since we have result
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        if (!mounted) return

        if (session && !error) {
          // Already logged in -> Redirect immediately
          hasRedirected.current = true
          router.replace(nextUrl)
        } else {
          // Not logged in or error -> Show Form
          setIsChecking(false)
        }
      } catch (err) {
        console.error('❌ [LoginPage] Session check error:', err)
        // If error, show login form
        if (mounted) {
          setIsChecking(false)
        }
      }
    }

    checkSession()

    // 2. Listen for login success event (from AuthForm or OAuth)
    const { data: authListener } = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session && !hasRedirected.current) {
        hasRedirected.current = true
        router.replace(nextUrl)
      }
    })

    return () => {
      mounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      authListener.subscription.unsubscribe()
    }
  }, [router, nextUrl])

  // Loading screen (black to match background)
  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-black text-white font-sans">
      <div className="w-full max-w-md mx-4 px-6 py-8">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-full bg-green-500/10 mb-4">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent mb-2">
            Cổ Phiếu Lướt Sóng
          </h1>
          <p className="text-gray-400 text-sm">Đăng nhập để tiếp tục hành trình đầu tư</p>
        </div>

        {/* Form Component */}
        <AuthForm />
        
      </div>
    </div>
  )
}

// Wrap with Suspense to avoid build error when using useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginContent />
    </Suspense>
  )
}
