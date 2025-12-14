'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Suspense } from 'react'

/**
 * Client-side OAuth callback handler
 * 
 * This page handles the OAuth callback from providers (Google, etc.)
 * using the client-side Supabase client which has access to the PKCE
 * code verifier stored in localStorage.
 * 
 * The detectSessionInUrl option (configured in supabaseClient.ts) automatically
 * processes the OAuth callback when the Supabase client initializes.
 */

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Prevent duplicate processing
    if (hasProcessed.current) return
    hasProcessed.current = true

    const handleCallback = async () => {
      try {
        // Check for OAuth error in URL
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')
        
        if (errorParam) {
          console.error('[Auth Callback] OAuth error:', errorParam, errorDescription)
          setError(errorDescription || errorParam)
          // Redirect to login with error after a short delay
          setTimeout(() => {
            router.replace(`/auth/login?error=${encodeURIComponent(errorDescription || errorParam)}`)
          }, 100)
          return
        }

        // Get the authorization code from URL
        const code = searchParams.get('code')
        
        if (!code) {
          console.warn('[Auth Callback] No authorization code present in callback URL')
          setError('Không tìm thấy mã xác thực. Vui lòng thử đăng nhập lại.')
          setTimeout(() => {
            router.replace('/auth/login?error=' + encodeURIComponent('Không tìm thấy mã xác thực. Vui lòng thử đăng nhập lại.'))
          }, 100)
          return
        }

        // Exchange the authorization code for a session
        // This uses the client-side Supabase client which has access to the
        // PKCE code verifier stored in localStorage
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        
        if (exchangeError) {
          console.error('[Auth Callback] Code exchange error:', exchangeError.message)
          setError(exchangeError.message)
          setTimeout(() => {
            router.replace(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`)
          }, 100)
          return
        }

        // Success - redirect to the dashboard
        const next = searchParams.get('next') || '/dashboard'
        router.replace(next)
      } catch (err) {
        console.error('[Auth Callback] Unexpected error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Lỗi xác thực không mong đợi'
        setError(errorMessage)
        setTimeout(() => {
          router.replace(`/auth/login?error=${encodeURIComponent(errorMessage)}`)
        }, 100)
      }
    }

    handleCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      {error ? (
        <div className="text-center px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Đăng nhập thất bại</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Đang chuyển hướng...</p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Đang xác thực...</p>
        </>
      )}
    </div>
  )
}

// Wrap with Suspense to avoid build error when using useSearchParams
export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400">Đang xác thực...</p>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
