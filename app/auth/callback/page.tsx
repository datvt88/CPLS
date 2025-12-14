'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Suspense } from 'react'

const isDev = process.env.NODE_ENV === 'development'

/**
 * Client-side OAuth Callback Handler
 * 
 * Xử lý OAuth callback với PKCE flow trên client-side vì:
 * 1. Code verifier được lưu trong localStorage của browser
 * 2. Server-side Route Handler không thể truy cập localStorage
 * 3. Supabase client với detectSessionInUrl: true tự động xử lý PKCE exchange
 */
function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Prevent double processing
    if (hasProcessed.current) return
    hasProcessed.current = true

    const handleCallback = async () => {
      try {
        if (isDev) console.log('[Auth Callback Page] Starting OAuth callback processing...')

        // 1. Kiểm tra nếu Google/Provider trả về lỗi ngay lập tức
        const errorParam = searchParams.get('error')
        const errorDesc = searchParams.get('error_description')
        
        if (errorParam) {
          console.error('[Auth Callback Page] Provider error:', errorParam, errorDesc)
          setStatus('error')
          setErrorMessage(errorDesc || errorParam)
          
          // Redirect về login với lỗi sau 2 giây
          setTimeout(() => {
            router.replace(`/auth/login?error=${errorParam}&error_description=${encodeURIComponent(errorDesc || '')}`)
          }, 2000)
          return
        }

        // 2. Lấy authorization code từ URL
        const code = searchParams.get('code')
        const next = searchParams.get('next') ?? '/dashboard'

        if (!code) {
          // Không có code - có thể là redirect từ session đã thiết lập
          // Kiểm tra session hiện tại
          const { data: sessionData } = await supabase.auth.getSession()
          
          if (sessionData.session) {
            if (isDev) console.log('[Auth Callback Page] Session already exists, redirecting...')
            setStatus('success')
            router.replace(next)
            return
          }
          
          console.error('[Auth Callback Page] No code and no session')
          setStatus('error')
          setErrorMessage('Không tìm thấy mã xác thực')
          
          setTimeout(() => {
            router.replace('/auth/login?error=NoCodeProvided')
          }, 2000)
          return
        }

        if (isDev) console.log('[Auth Callback Page] Code received, exchanging for session...')

        // 3. Exchange code for session (PKCE)
        // Supabase client sẽ tự động đọc code verifier từ localStorage
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error) {
          console.error('[Auth Callback Page] Exchange code failed:', error.message)
          setStatus('error')
          setErrorMessage(error.message)
          
          setTimeout(() => {
            router.replace(`/auth/login?error=ServerAuthError&error_description=${encodeURIComponent(error.message)}`)
          }, 2000)
          return
        }

        if (data.session) {
          if (isDev) console.log('[Auth Callback Page] ✅ Session established for user:', data.session.user.id.slice(0, 8) + '...')
          setStatus('success')
          
          // Đợi một chút để session được sync
          setTimeout(() => {
            router.replace(next)
          }, 500)
        } else {
          console.error('[Auth Callback Page] No session returned')
          setStatus('error')
          setErrorMessage('Không thể thiết lập phiên đăng nhập')
          
          setTimeout(() => {
            router.replace('/auth/login?error=NoSession')
          }, 2000)
        }
      } catch (err) {
        console.error('[Auth Callback Page] Unexpected error:', err)
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Lỗi không xác định')
        
        setTimeout(() => {
          router.replace('/auth/login?error=UnexpectedError')
        }, 2000)
      }
    }

    handleCallback()
  }, [router, searchParams])

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
