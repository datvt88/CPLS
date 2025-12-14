'use client'

import { useEffect, useState, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ERROR_REDIRECT_DELAY, 
  SUCCESS_REDIRECT_DELAY, 
  MAX_SESSION_WAIT_TIME,
  SUPABASE_PROCESSING_DELAY
} from '@/lib/auth/constants'
import type { Session } from '@supabase/supabase-js'

const isDev = process.env.NODE_ENV === 'development'

/**
 * Client-side OAuth Callback Handler
 * 
 * Handles OAuth callback with PKCE flow on client-side:
 * 1. Code verifier is stored in browser's localStorage
 * 2. Server-side Route Handler cannot access localStorage
 * 3. Supabase client with detectSessionInUrl: true automatically handles PKCE exchange
 * 
 * IMPORTANT: Do not call exchangeCodeForSession() manually as detectSessionInUrl 
 * already handles it automatically. Just wait for auth state change event.
 */
function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasProcessed = useRef(false)
  const hasRedirected = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Stable callback to handle successful session
  const handleSuccess = useCallback((session: Session, next: string) => {
    if (hasRedirected.current) return
    hasRedirected.current = true
    
    if (isDev) console.log('[Auth Callback Page] ✅ Session established for user:', session.user.id.slice(0, 8) + '...')
    setStatus('success')
    
    setTimeout(() => {
      router.replace(next)
    }, SUCCESS_REDIRECT_DELAY)
  }, [router])

  useEffect(() => {
    // Prevent double processing
    if (hasProcessed.current) return
    hasProcessed.current = true

    if (isDev) console.log('[Auth Callback Page] Starting OAuth callback processing...')

    // 1. Check if OAuth provider returned an error
    const errorParam = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')
    
    if (errorParam) {
      console.error('[Auth Callback Page] Provider error:', errorParam, errorDesc)
      setStatus('error')
      setErrorMessage(errorDesc || errorParam)
      
      // Redirect to login with error
      setTimeout(() => {
        router.replace(`/auth/login?error=${errorParam}&error_description=${encodeURIComponent(errorDesc || '')}`)
      }, ERROR_REDIRECT_DELAY)
      return
    }

    // 2. Get next URL from params
    const next = searchParams.get('next') ?? '/dashboard'

    if (isDev) console.log('[Auth Callback Page] Will redirect to:', next)

    // 3. Set up timeout for session wait
    timeoutRef.current = setTimeout(() => {
      if (!hasRedirected.current) {
        console.error('[Auth Callback Page] Session wait timeout')
        setStatus('error')
        setErrorMessage('Quá thời gian đợi xác thực. Vui lòng thử lại.')
        
        setTimeout(() => {
          router.replace('/auth/login?error=Timeout')
        }, ERROR_REDIRECT_DELAY)
      }
    }, MAX_SESSION_WAIT_TIME)

    // 4. Listen for auth state changes
    // Supabase's detectSessionInUrl will automatically process the code and fire SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isDev) console.log('[Auth Callback Page] Auth event:', event)
      
      if (event === 'SIGNED_IN' && session) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        handleSuccess(session, next)
      }
    })

    // 5. Also check if session already exists (in case SIGNED_IN was already fired before listener)
    const checkExistingSession = async () => {
      try {
        // Give Supabase time to process the URL first
        await new Promise(resolve => setTimeout(resolve, SUPABASE_PROCESSING_DELAY))
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[Auth Callback Page] getSession error:', error.message)
          return
        }
        
        if (session) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          handleSuccess(session, next)
        }
      } catch (err) {
        console.error('[Auth Callback Page] Error checking session:', err)
      }
    }

    checkExistingSession()

    // Cleanup
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      subscription.unsubscribe()
    }
  }, [router, searchParams, handleSuccess])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      {status === 'loading' && (
        <>
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 text-sm">Đang xác thực...</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-green-500 text-sm">Đăng nhập thành công!</p>
          <p className="text-gray-500 text-xs mt-1">Đang chuyển hướng...</p>
        </>
      )}
      
      {status === 'error' && (
        <>
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-red-500 text-sm">Đăng nhập thất bại</p>
          <p className="text-gray-500 text-xs mt-1">{errorMessage || 'Đang chuyển hướng...'}</p>
        </>
      )}
    </div>
  )
}

// Wrap with Suspense để tránh lỗi build khi dùng useSearchParams
export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  )
}
