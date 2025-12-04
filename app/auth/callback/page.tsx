'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()

  const [status, setStatus] =
    useState<'loading' | 'success' | 'error'>('loading')
  const [progressMessage, setProgressMessage] =
    useState('Đang kiểm tra phiên đăng nhập...')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const run = async () => {
      try {
        /** STEP 1 — Nếu đã có session → DONE */
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession()

        if (existingSession) {
          return loginSuccess('Đã tìm thấy phiên đăng nhập!')
        }

        /** STEP 2 — Nếu Supabase gửi OAuth qua hash (#access_token...) */
        if (window.location.hash.includes('access_token')) {
          return await finishOAuthFromHash()
        }

        /** STEP 3 — Supabase đang sync, chờ nhẹ */
        setProgressMessage('Đang hoàn tất xác thực...')
        await new Promise((r) => setTimeout(r, 350))

        const {
          data: { session: syncedSession },
        } = await supabase.auth.getSession()

        if (syncedSession) {
          return loginSuccess('Đăng nhập thành công!')
        }

        /** STEP 4 — Không có session */
        return showError('Không tìm thấy phiên đăng nhập. Vui lòng thử lại.')
      } catch (e: any) {
        return showError(e?.message || 'Lỗi không xác định')
      }
    }

    run()
  }, [])

  /* ---------------------------------------------------------
   * XỬ LÝ CALLBACK TỪ SUPABASE (qua "#access_token=...")
   * --------------------------------------------------------- */
  const finishOAuthFromHash = async () => {
    try {
      setProgressMessage('Đang xác thực với Supabase...')

      // Supabase tự đọc hash → tạo session nội bộ
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error || !session) {
        return showError('Không lấy được session từ Supabase.')
      }

      return loginSuccess('Đăng nhập thành công!')
    } catch (e: any) {
      return showError(e.message)
    }
  }

  /* ---------------------------------------------------------
   * SUCCESS
   * --------------------------------------------------------- */
  const loginSuccess = (msg = 'Đăng nhập thành công!') => {
    setStatus('success')
    setProgressMessage(msg)

    // Xóa hash: /auth/callback → sạch URL
    if (window.location.hash) {
      window.history.replaceState({}, '', window.location.pathname)
    }

    setTimeout(() => router.push('/dashboard'), 700)
  }

  /* ---------------------------------------------------------
   * ERROR
   * --------------------------------------------------------- */
  const showError = (msg: string) => {
    setStatus('error')
    setErrorMessage(msg)

    setTimeout(() => router.push('/login'), 2500)
  }

  /* ---------------------------------------------------------
   * UI
   * --------------------------------------------------------- */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
      <div className="bg-[--panel] rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {/* LOADING */}
        {status === 'loading' && (
          <>
            <div className="mb-4">
              <svg
                className="animate-spin h-12 w-12 text-[--accent] mx-auto"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.3 0 0 5.3 0 12h4z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đang xác thực...
            </h2>
            <p className="text-[--muted]">{progressMessage}</p>
          </>
        )}

        {/* SUCCESS */}
        {status === 'success' && (
          <>
            <svg
              className="h-12 w-12 text-green-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>

            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thành công!
            </h2>
            <p className="text-[--muted]">Đang chuyển hướng...</p>
          </>
        )}

        {/* ERROR */}
        {status === 'error' && (
          <>
            <svg
              className="h-12 w-12 text-red-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
