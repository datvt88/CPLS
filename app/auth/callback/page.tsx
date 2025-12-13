'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { supabase } from '@/lib/supabaseClient'
import { usePermissions } from '@/contexts/PermissionsContext'

// Configuration constants
const AUTH_CALLBACK_TIMEOUT = 15000 // 15 seconds max wait
const REDIRECT_DELAY = 500 // Reduced delay for faster redirect
const SESSION_VERIFY_DELAY = 300 // Time to verify session is stable

type Status = 'loading' | 'success' | 'error'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const hasHandledRef = useRef(false)
  const mountedRef = useRef(true)
  const { refresh } = usePermissions()

  // Handle successful authentication
  const handleSuccess = useCallback(async () => {
    if (!mountedRef.current || hasHandledRef.current) return
    
    hasHandledRef.current = true
    setStatus('success')
    
    // Clean up URL
    window.history.replaceState({}, '', '/auth/callback')
    
    // Refresh permissions context to ensure it has the latest auth state
    try {
      await refresh()
      // Give a small delay for state to propagate
      await new Promise(resolve => setTimeout(resolve, SESSION_VERIFY_DELAY))
    } catch (refreshError) {
      console.warn('[AuthCallback] Permissions refresh warning:', refreshError)
    }
    
    // Redirect to dashboard
    setTimeout(() => {
      if (mountedRef.current) {
        router.push('/dashboard')
      }
    }, REDIRECT_DELAY)
  }, [router, refresh])

  // Handle authentication error
  const handleError = useCallback((message: string) => {
    if (!mountedRef.current || hasHandledRef.current) return
    
    hasHandledRef.current = true
    console.error('[AuthCallback] Error:', message)
    setStatus('error')
    setErrorMessage(message)
    
    setTimeout(() => {
      if (mountedRef.current) {
        router.push('/auth/login')
      }
    }, 2500)
  }, [router])

  useEffect(() => {
    mountedRef.current = true
    let timeoutId: NodeJS.Timeout | null = null
    
    const handleAuth = async () => {
      if (hasHandledRef.current) return

      // Set timeout for the entire process
      timeoutId = setTimeout(() => {
        if (!hasHandledRef.current && mountedRef.current) {
          // One final attempt before giving up
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user && !hasHandledRef.current) {
              handleSuccess()
            } else if (!hasHandledRef.current) {
              handleError('Quá thời gian xác thực. Vui lòng thử lại.')
            }
          }).catch(() => {
            if (!hasHandledRef.current) {
              handleError('Quá thời gian xác thực. Vui lòng thử lại.')
            }
          })
        }
      }, AUTH_CALLBACK_TIMEOUT)

      try {
        // Check for OAuth error in URL
        const url = new URL(window.location.href)
        const errorParam = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')
        
        if (errorParam) {
          if (timeoutId) clearTimeout(timeoutId)
          handleError(errorDescription || `Lỗi xác thực: ${errorParam}`)
          return
        }

        // Use the auth service to handle OAuth callback
        const { session, error } = await authService.handleOAuthCallback()
        
        if (timeoutId) clearTimeout(timeoutId)
        
        if (error) {
          handleError(error.message || 'Không thể xác thực phiên đăng nhập')
          return
        }
        
        if (session?.user) {
          handleSuccess()
          return
        }
        
        // No session found
        handleError('Không thể xác thực phiên đăng nhập. Vui lòng thử đăng nhập lại.')
        
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId)
        console.error('[AuthCallback] Unexpected error:', err)
        handleError('Lỗi không xác định khi xác thực. Vui lòng thử lại.')
      }
    }

    handleAuth()

    // Listen for auth state changes as a fallback
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user && !hasHandledRef.current) {
        handleSuccess()
      }
    })

    return () => {
      mountedRef.current = false
      if (timeoutId) clearTimeout(timeoutId)
      authListener.subscription.unsubscribe()
    }
  }, [handleSuccess, handleError])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
      <div className="bg-[--panel] rounded-lg shadow-lg p-8 max-w-md w-full text-center">

        {status === 'loading' && (
          <>
            <div className="mb-4">
              <div className="animate-spin h-12 w-12 border-4 border-[--accent] border-t-transparent rounded-full mx-auto"></div>
            </div>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đang xác thực...
            </h2>
            <p className="text-[--muted]">Vui lòng đợi trong giây lát</p>
          </>
        )}

        {status === 'success' && (
          <>
            <svg className="h-12 w-12 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thành công!
            </h2>
            <p className="text-[--muted]">Đang chuyển hướng...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <svg className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thất bại
            </h2>
            <p className="text-[--muted] mb-4 whitespace-pre-line">{errorMessage}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg p-3 shadow-lg"
            >
              Quay lại đăng nhập
            </button>
          </>
        )}

      </div>
    </div>
  )
}
