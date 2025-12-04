'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()

  const [status, setStatus] =
    useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [progressMessage, setProgressMessage] = useState(
    'Đang kiểm tra phiên đăng nhập...'
  )

  useEffect(() => {
    const aborter = new AbortController()

    handleAuth().catch((err) => {
      if (!aborter.signal.aborted) {
        console.error('❌ Callback error:', err)
        showError('Có lỗi xảy ra khi đăng nhập')
      }
    })

    return () => aborter.abort()
  }, [])

  /** ------------------------------------------------------------------
   * MAIN AUTH HANDLER
   * ------------------------------------------------------------------*/
  const handleAuth = async () => {
    setProgressMessage('Đang kiểm tra phiên đăng nhập...')

    /** STEP 1 — Kiểm tra session hiện có */
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      return loginSuccess('Đã tìm thấy phiên đăng nhập!')
    }

    /** STEP 2 — Google OAuth callback từ Supabase */
    if (window.location.hash.includes('access_token')) {
      return handleSupabaseOAuth()
    }

    /** STEP 3 — Chờ Supabase đồng bộ (tránh load quá nhanh) */
    setProgressMessage('Đang hoàn tất xác thực...')
    await new Promise((r) => setTimeout(r, 300))

    const {
      data: { session: session2 },
    } = await supabase.auth.getSession()

    if (session2) return loginSuccess()

    /** STEP 4 — Không có session */
    return showError('Không tìm thấy phiên đăng nhập. Vui lòng thử lại.')
  }

  /** ------------------------------------------------------------------
   * SUPABASE OAUTH: Google (Supabase tự tạo session)
   * ------------------------------------------------------------------*/
  const handleSupabaseOAuth = async () => {
    try {
      setProgressMessage('Đang xác thực với Google...')

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error || !session) {
        return showError('Không thể lấy phiên đăng nhập từ Supabase')
      }

      return loginSuccess('Đăng nhập thành công!')
    } catch (err: any) {
      return showError(err.message)
    }
  }

  /** ------------------------------------------------------------------
   * SUCCESS + ERROR
   * ------------------------------------------------------------------*/
  const loginSuccess = (msg = 'Đăng nhập thành công!') => {
    setStatus('success')
    setProgressMessage(msg)

    // Xóa hash gây rối
    window.history.replaceState({}, '', '/callback')

    setTimeout(() => router.push('/dashboard'), 600)
  }

  const showError = (msg: string) => {
    console.error('❌ Auth error:', msg)
    setErrorMessage(msg)
    setStatus('error')
    setTimeout(() => router.push('/login'), 2500)
  }

  /** ------------------------------------------------------------------
   * UI
   * ------------------------------------------------------------------*/
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
      <div className="bg-[--panel] rounded-lg shadow-lg p-8 max-w-md w-full text-center">

        {/* Loading */}
        {status === 'loading' && (
          <>
            <div className="mb-4">
              <svg className="animate-spin h-12 w-12 text-[--accent] mx-auto" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.3..." />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đang xác thực...
            </h2>
            <p className="text-[--muted]">{progressMessage}</p>
          </>
        )}

        {/* Success */}
        {status === 'success' && (
          <>
            <svg className="h-12 w-12 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thành công!
            </h2>
            <p className="text-[--muted]">Đang chuyển hướng...</p>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <svg className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2" />
            </svg>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thất bại
            </h2>
            <p className="text-[--muted] mb-4 whitespace-pre-line">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg p-3 shadow-lg"
            >
              Thử lại
            </button>
          </>
        )}
      </div>
    </div>
  )
}
