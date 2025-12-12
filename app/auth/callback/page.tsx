'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [progressMessage, setProgressMessage] = useState('Đang kiểm tra phiên đăng nhập...')
  const statusRef = useRef<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null

    const handleAuth = async () => {
      try {
        // Set timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (isMounted && statusRef.current === 'loading') {
            console.warn('⏱️ [AuthCallback] Timeout - redirecting to login')
            statusRef.current = 'error'
            setStatus('error')
            setErrorMessage('Quá thời gian xác thực. Vui lòng thử lại.')
            setTimeout(() => router.push('/login'), 2000)
          }
        }, 10000) // 10 second timeout

        setProgressMessage('Đang kiểm tra phiên đăng nhập...')

        // Check if we have a code in URL (OAuth callback)
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const errorParam = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        // Handle OAuth error
        if (errorParam) {
          console.error('❌ [AuthCallback] OAuth error:', errorParam, errorDescription)
          if (isMounted) {
            statusRef.current = 'error'
            setStatus('error')
            setErrorMessage(errorDescription || 'Lỗi xác thực OAuth')
            setTimeout(() => router.push('/login'), 2500)
          }
          return
        }

        // If we have a code, Supabase will handle the exchange automatically
        if (code) {
          setProgressMessage('Đang xác thực với máy chủ...')
          console.log('🔑 [AuthCallback] OAuth code detected, waiting for session exchange...')
        }

        // Wait a short moment for Supabase to process the code
        await new Promise((r) => setTimeout(r, 500))

        // Try to get the session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('❌ [AuthCallback] Session error:', error)
          if (isMounted) {
            statusRef.current = 'error'
            setStatus('error')
            setErrorMessage('Lỗi xác thực: ' + error.message)
            setTimeout(() => router.push('/login'), 2500)
          }
          return
        }

        if (session?.user) {
          console.log('✅ [AuthCallback] Session valid, redirecting to dashboard')
          if (isMounted) {
            statusRef.current = 'success'
            setStatus('success')
            setProgressMessage('Đăng nhập thành công!')
            
            // Clean up URL
            window.history.replaceState({}, '', '/auth/callback')
            
            setTimeout(() => router.push('/dashboard'), 600)
          }
          return
        }

        // No session yet, try one more time after a delay
        console.log('⏳ [AuthCallback] No session yet, retrying...')
        await new Promise((r) => setTimeout(r, 1000))
        
        const { data: { session: retrySession } } = await supabase.auth.getSession()
        
        if (retrySession?.user) {
          console.log('✅ [AuthCallback] Session found on retry')
          if (isMounted) {
            statusRef.current = 'success'
            setStatus('success')
            setProgressMessage('Đăng nhập thành công!')
            window.history.replaceState({}, '', '/auth/callback')
            setTimeout(() => router.push('/dashboard'), 600)
          }
          return
        }

        // Still no session
        console.warn('⚠️ [AuthCallback] No session after retries')
        if (isMounted) {
          statusRef.current = 'error'
          setStatus('error')
          setErrorMessage('Không thể xác thực phiên đăng nhập.')
          setTimeout(() => router.push('/login'), 2500)
        }
      } catch (err) {
        console.error('❌ [AuthCallback] Unexpected error:', err)
        if (isMounted) {
          statusRef.current = 'error'
          setStatus('error')
          setErrorMessage('Lỗi không xác định khi xác thực.')
          setTimeout(() => router.push('/login'), 2500)
        }
      }
    }

    handleAuth()

    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [router])

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
