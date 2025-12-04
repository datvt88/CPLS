'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] =
    useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [progressMessage, setProgressMessage] = useState(
    'Đang kiểm tra phiên đăng nhập...'
  )

  useEffect(() => {
    const controller = new AbortController()

    handleCallback().catch((err) => {
      if (controller.signal.aborted) return
      console.error('❌ Callback root error:', err)
      showError(err.message || 'Có lỗi xảy ra khi xác thực')
    })

    return () => controller.abort()
  }, [])

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

  /** ------------------------------------------------------------------
   * MAIN CALLBACK HANDLER
   * -----------------------------------------------------------------*/
  const handleCallback = async () => {
    setProgressMessage('Đang kiểm tra phiên đăng nhập...')

    // STEP 1 — Check existing session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session) {
      return loginSuccess('Đã tìm thấy phiên đăng nhập!')
    }

    // STEP 2 — Read OAuth fragments from URL
    const hash = new URLSearchParams(window.location.hash.replace('#', ''))
    const accessToken = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const oauthError = hash.get('error')

    if (oauthError)
      return showError(`OAuth error: ${oauthError}`)

    // → Google / Github OAuth handled by Supabase automatically.
    if (accessToken) {
      return handleSupabaseOAuth()
    }

    // STEP 3 — ZALO OAuth (using query params, not hash)
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const zaloError = params.get('error')

    if (zaloError) return showError(`Zalo OAuth lỗi: ${zaloError}`)

    if (code && state) {
      return handleZaloOAuth(code, state)
    }

    // STEP 4 — Final fallback (Supabase sometimes needs 300–800ms to restore session)
    setProgressMessage('Đang hoàn tất xác thực...')
    await delay(400)

    const {
      data: { session: lastCheck },
    } = await supabase.auth.getSession()

    if (lastCheck) return loginSuccess()

    return showError('Không tìm thấy thông tin xác thực. Vui lòng thử lại.')
  }

  /** ------------------------------------------------------------------
   * SUPABASE OAUTH (Google/Github)
   * Supabase TỰ ĐỘNG tạo session — KHÔNG setSession thủ công nữa.
   * -----------------------------------------------------------------*/
  const handleSupabaseOAuth = async () => {
    try {
      setProgressMessage('Đang xác thực với nhà cung cấp...')

      // Supabase session already stored → just fetch
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error || !session) {
        return showError('Không thể tạo phiên đăng nhập từ Supabase')
      }

      return loginSuccess('Đăng nhập thành công!')
    } catch (err: any) {
      return showError(err.message)
    }
  }

  /** ------------------------------------------------------------------
   * ZALO OAuth custom login (PKCE)
   * -----------------------------------------------------------------*/
  const handleZaloOAuth = async (code: string, state: string) => {
    try {
      setProgressMessage('Đang xác thực với Zalo...')

      const storedState = sessionStorage.getItem('zalo_oauth_state')
      const verifier = sessionStorage.getItem('zalo_code_verifier')

      if (!storedState || state !== storedState)
        return showError('Lỗi bảo mật. Vui lòng thử lại.')

      if (!verifier)
        return showError('Phiên Zalo hết hạn. Vui lòng thử lại.')

      // Cleanup early
      sessionStorage.removeItem('zalo_oauth_state')
      sessionStorage.removeItem('zalo_code_verifier')

      /** --- STEP 1: Exchange CODE → TOKEN --- */
      const tokenRes = await fetch('/api/auth/zalo/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier }),
      })

      const token = await tokenRes.json()
      if (!tokenRes.ok) return showError(token.error || 'Không thể lấy token Zalo')

      /** --- STEP 2: Fetch user info --- */
      const userRes = await fetch('/api/auth/zalo/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token.access_token }),
      })

      const zaloUser = await userRes.json()
      if (!userRes.ok) return showError(zaloUser.error)

      /** --- STEP 3: Login / Create Supabase user --- */
      const email = `zalo_${zaloUser.id}@cpls.app`
      const pass = `zalo_${zaloUser.id}_pw_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 6)}`

      let session
      const signIn = await authService.signIn({ email, password: pass })

      if (signIn.error) {
        const signup = await authService.signUp({ email, password: pass })
        if (signup.error) return showError(signup.error.message)
        session = signup.data.session
      } else {
        session = signIn.data.session
      }

      if (!session) return showError('Không thể tạo phiên đăng nhập')

      /** --- STEP 4: Update profile --- */
      await profileService.upsertProfile({
        id: session.user.id,
        email,
        full_name: zaloUser.name,
        phone_number: zaloUser.phone || '0000000000',
        avatar_url: zaloUser.picture,
        zalo_id: zaloUser.id,
      })

      return loginSuccess()
    } catch (err: any) {
      console.error(err)
      return showError(err.message)
    }
  }

  /** ------------------------------------------------------------------
   * SUCCESS / ERROR HANDLERS
   * -----------------------------------------------------------------*/
  const loginSuccess = (msg = 'Đăng nhập thành công!') => {
    setProgressMessage(msg)
    setStatus('success')

    // Clean URL
    window.history.replaceState({}, '', '/callback')

    setTimeout(() => router.push('/dashboard'), 600)
  }

  const showError = (msg: string) => {
    console.error('❌ ERROR:', msg)
    setErrorMessage(msg)
    setStatus('error')

    setTimeout(() => router.push('/login'), 3000)
  }

  /** ------------------------------------------------------------------
   * UI
   * -----------------------------------------------------------------*/
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
            <h2 className="text-xl font-semibold text-[--fg] mb-2">Đang xác thực...</h2>
            <p className="text-[--muted]">{progressMessage}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <svg className="h-12 w-12 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4..." />
            </svg>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">Đăng nhập thành công!</h2>
            <p className="text-[--muted]">Đang chuyển hướng...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <svg className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2..." />
            </svg>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">Đăng nhập thất bại</h2>
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
