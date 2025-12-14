'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { AuthForm } from '@/components/AuthForm'
import { Suspense } from 'react'

// Timeout for session check
const SESSION_CHECK_TIMEOUT = 3000

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isChecking, setIsChecking] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasRedirected = useRef(false)

  // Get destination URL (if any), or default to dashboard
  const nextUrl = searchParams.get('next') || '/dashboard'
  
  // Get error from OAuth callback (if any)
  const oauthError = searchParams.get('error')

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout | null = null

    // Set error message from OAuth callback if present
    if (oauthError) {
      setErrorMessage(oauthError)
      setIsChecking(false)
      return
    }

    const checkSession = async () => {
      try {
        // Set timeout to ensure form will show if session check takes too long
        timeoutId = setTimeout(() => {
          if (mounted && !hasRedirected.current) {
            setIsChecking(false)
          }
        }, SESSION_CHECK_TIMEOUT)

        // Check session
        const { session, error } = await authService.getSession()

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
      } catch {
        if (mounted) {
          setIsChecking(false)
        }
      }
    }

    checkSession()

    // Listen for login success event
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
  }, [router, nextUrl, oauthError])

  // Loading screen
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
        
        {/* OAuth Error Message */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-red-500 font-medium">Đăng nhập thất bại</h3>
                <p className="text-red-400/80 text-sm mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}
        
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
