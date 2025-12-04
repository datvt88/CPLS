'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthCallbackPage() {
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [progressMessage, setProgressMessage] = useState('Đang kiểm tra phiên đăng nhập...')

  useEffect(() => {
    handleAuth().catch((err) => {
      console.error(err)
      showError('Lỗi không xác định khi xác thực.')
    })
  }, [])

  /* --------------------------------------------------
     MAIN AUTH HANDLER
  ---------------------------------------------------*/
  const handleAuth = async () => {
    setProgressMessage('Đang kiểm tra phiên đăng nhập...')

    // STEP 1: thử lấy session ngay
    let { data: sessionResp } = await supabase.auth.getSession()

    if (sessionResp.session) {
      return loginSuccess('Phiên đăng nhập hợp lệ!')
    }

    // STEP 2 — xử lý khi callback có code_challenge (PKCE)
    if (window.location.href.includes('code=')) {
      setProgressMessage('Đang xác thực với máy chủ...')
    }

    // STEP 3 — đợi refresh (PKCE cần)
    await new Promise((r) => setTimeout(r, 400))

    let { data: sessionResp2 } = await supabase.auth.getSession()

    if (sessionResp2.session) {
      return loginSuccess('Đăng nhập thành công!')
    }

    // Không có session
    return showError('Không thể xác thực phiên đăng nhập.')
  }

  /* --------------------------------------------------
     SUCCESS / ERROR HANDLER
  ---------------------------------------------------*/
  const loginSuccess = (msg = 'Đăng nhập thành công!') => {
    setStatus('success')
    setProgressMessage(msg)

    // Xóa query code để tránh Supabase detect lại
    window.history.replaceState({}, '', '/auth/callback')

    setTimeout(() => router.push('/dashboard'), 600)
  }

  const showError = (msg: string) => {
    setStatus('error')
    setErrorMessage(msg)
    setTimeout(() => router.push('/login'), 2500)
  }

  /* --------------------------------------------------
     UI
  ---------------------------------------------------*/
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
      <div className="bg-[--panel] rounded-lg shadow-lg p-8 max-w-md w-full text-center">

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

        {status === 'error' && (
          <>
            <svg className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2" />
            </svg>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thất bại
            </h2>
            <p className="text-[--muted] mb-4 whitespace-pre-line">{errorMessage}</p>
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
