'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Auth callback configuration constants
const AUTH_CALLBACK_TIMEOUT = 20000 // 20 seconds total timeout (increased)
const RETRY_MAX_ATTEMPTS = 5 // Increased retry attempts
const RETRY_BASE_DELAY_MS = 800 // Exponential backoff: 800ms, 1600ms, 3200ms, 6400ms
const POST_AUTH_STABILIZATION_DELAY = 1500 // Wait for auth to stabilize before redirect

export default function AuthCallbackPage() {
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [progressMessage, setProgressMessage] = useState('Đang kiểm tra phiên đăng nhập...')
  const statusRef = useRef<'loading' | 'success' | 'error'>('loading')
  const isProcessingRef = useRef(false)
  const hasHandledRef = useRef(false)

  // Helper: Success handler
  const handleSuccess = useCallback((isMounted: boolean) => {
    if (isMounted && statusRef.current !== 'success' && !hasHandledRef.current) {
      hasHandledRef.current = true
      console.log('✅ [AuthCallback] Authentication successful!')
      statusRef.current = 'success'
      setStatus('success')
      setProgressMessage('Đăng nhập thành công!')
      
      // Clean up URL parameters
      window.history.replaceState({}, '', '/auth/callback')
      
      // Wait for auth to stabilize before redirect
      setTimeout(() => {
        if (isMounted) {
          router.push('/dashboard')
        }
      }, POST_AUTH_STABILIZATION_DELAY)
    }
  }, [router])

  // Helper: Error handler
  const handleError = useCallback((message: string, isMounted: boolean) => {
    if (isMounted && statusRef.current !== 'error' && !hasHandledRef.current) {
      hasHandledRef.current = true
      console.error('❌ [AuthCallback] Error:', message)
      statusRef.current = 'error'
      setStatus('error')
      setErrorMessage(message)
      setTimeout(() => {
        if (isMounted) {
          router.push('/login')
        }
      }, 2500)
    }
  }, [router])

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null

    const handleAuth = async () => {
      // Prevent duplicate processing
      if (isProcessingRef.current || hasHandledRef.current) {
        console.log('⏳ [AuthCallback] Already processing or handled, skipping...')
        return
      }
      isProcessingRef.current = true

      try {
        // Set timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (isMounted && statusRef.current === 'loading' && !hasHandledRef.current) {
            console.warn('⏱️ [AuthCallback] Timeout - checking session one more time')
            // One final attempt before giving up
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session?.user && isMounted && !hasHandledRef.current) {
                handleSuccess(isMounted)
              } else if (isMounted && !hasHandledRef.current) {
                handleError('Quá thời gian xác thực. Vui lòng thử lại.', isMounted)
              }
            }).catch(() => {
              if (isMounted && !hasHandledRef.current) {
                handleError('Quá thời gian xác thực. Vui lòng thử lại.', isMounted)
              }
            })
          }
        }, AUTH_CALLBACK_TIMEOUT)

        setProgressMessage('Đang kiểm tra phiên đăng nhập...')

        // Parse URL parameters
        const url = new URL(window.location.href)
        const hashParams = new URLSearchParams(url.hash.substring(1))
        const code = url.searchParams.get('code')
        const errorParam = url.searchParams.get('error') || hashParams.get('error')
        const errorDescription = url.searchParams.get('error_description') || hashParams.get('error_description')
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        console.log('🔑 [AuthCallback] URL params:', {
          hasCode: !!code,
          hasAccessToken: !!accessToken,
          hasError: !!errorParam,
          codePrefix: code?.substring(0, 10)
        })

        // Handle OAuth error from provider
        if (errorParam) {
          console.error('❌ [AuthCallback] OAuth error from provider:', errorParam, errorDescription)
          handleError(errorDescription || `Lỗi xác thực: ${errorParam}`, isMounted)
          return
        }

        // Case 1: Implicit flow - tokens in hash fragment
        if (accessToken && refreshToken) {
          console.log('🔐 [AuthCallback] Implicit flow detected, setting session...')
          setProgressMessage('Đang thiết lập phiên đăng nhập...')

          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('❌ [AuthCallback] Failed to set session:', sessionError)
            handleError(`Không thể thiết lập phiên: ${sessionError.message}`, isMounted)
            return
          }

          // Wait a bit for session to be saved
          await new Promise(r => setTimeout(r, 500))
          
          handleSuccess(isMounted)
          return
        }

        // Case 2: PKCE flow - authorization code in query params
        if (code) {
          console.log('🔐 [AuthCallback] PKCE flow detected, exchanging code for session...')
          setProgressMessage('Đang xác thực với máy chủ...')

          // Method 1: Try to exchange code directly using exchangeCodeForSession
          try {
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

            if (exchangeError) {
              console.error('❌ [AuthCallback] Code exchange error:', exchangeError.message)
              
              // Check if error is due to code already being used (possible page refresh)
              if (exchangeError.message.includes('already used') || 
                  exchangeError.message.includes('invalid') ||
                  exchangeError.message.includes('expired')) {
                // Try to check if we already have a valid session
                await new Promise(r => setTimeout(r, 500)) // Small delay
                const { data: existingSession } = await supabase.auth.getSession()
                if (existingSession?.session?.user) {
                  console.log('✅ [AuthCallback] Found existing session after code error')
                  handleSuccess(isMounted)
                  return
                }
              }

              handleError(`Không thể xác thực: ${exchangeError.message}`, isMounted)
              return
            }

            if (data?.session?.user) {
              console.log('✅ [AuthCallback] Code exchange successful')
              // Wait a bit for session to be saved
              await new Promise(r => setTimeout(r, 500))
              handleSuccess(isMounted)
              return
            }
          } catch (exchangeErr) {
            console.error('❌ [AuthCallback] Exchange code exception:', exchangeErr)
            // Continue to fallback methods
          }
        }

        // Case 3: No code/tokens - check if session already exists (e.g., page refresh)
        console.log('🔍 [AuthCallback] Checking for existing session...')
        setProgressMessage('Đang kiểm tra phiên đăng nhập...')

        // Retry logic with exponential backoff
        for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
          if (!isMounted || hasHandledRef.current) break
          
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession()

            if (sessionError) {
              console.error(`❌ [AuthCallback] Session check error (attempt ${attempt}):`, sessionError)
            }

            if (session?.user) {
              console.log(`✅ [AuthCallback] Session found on attempt ${attempt}`)
              handleSuccess(isMounted)
              return
            }

            if (attempt < RETRY_MAX_ATTEMPTS) {
              const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
              console.log(`⏳ [AuthCallback] No session yet, retrying in ${delay}ms (attempt ${attempt}/${RETRY_MAX_ATTEMPTS})...`)
              setProgressMessage(`Đang xác thực... (${attempt}/${RETRY_MAX_ATTEMPTS})`)
              await new Promise(r => setTimeout(r, delay))
            }
          } catch (error) {
            console.error(`❌ [AuthCallback] Session check exception (attempt ${attempt}):`, error)
            if (attempt < RETRY_MAX_ATTEMPTS) {
              const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
              await new Promise(r => setTimeout(r, delay))
            }
          }
        }

        // All retries exhausted
        if (!hasHandledRef.current) {
          console.warn('⚠️ [AuthCallback] No session found after all retries')
          handleError('Không thể xác thực phiên đăng nhập. Vui lòng thử đăng nhập lại.', isMounted)
        }

      } catch (err) {
        console.error('❌ [AuthCallback] Unexpected error:', err)
        if (!hasHandledRef.current) {
          handleError('Lỗi không xác định khi xác thực. Vui lòng thử lại.', isMounted)
        }
      } finally {
        isProcessingRef.current = false
      }
    }

    handleAuth()

    // Also listen for auth state changes as a fallback
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔔 [AuthCallback] Auth state change: ${event}`)
      
      if (event === 'SIGNED_IN' && session?.user && isMounted && statusRef.current === 'loading' && !hasHandledRef.current) {
        console.log('✅ [AuthCallback] Signed in via auth state change')
        handleSuccess(isMounted)
      }
    })

    return () => {
      isMounted = false
      isProcessingRef.current = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      authListener.subscription.unsubscribe()
    }
  }, [router, handleSuccess, handleError])

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
            <p className="text-[--muted]">{progressMessage}</p>
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
              onClick={() => router.push('/login')}
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
