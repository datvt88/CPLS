'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [progressMessage, setProgressMessage] = useState('Đang kiểm tra phiên đăng nhập...')

  // -----------------------------
  // Main Handler
  // -----------------------------
  useEffect(() => {
    let mounted = true

    const run = async () => {
      try {
        await processCallback()

        if (!mounted) return
        setStatus('success')

        setTimeout(() => router.push('/dashboard'), 500)
      } catch (err: any) {
        if (!mounted) return
        console.error('❌ Callback Error:', err)

        setStatus('error')
        setErrorMessage(err?.message || 'Đã xảy ra lỗi không xác định')

        setTimeout(() => router.push('/login'), 2000)
      }
    }

    run()

    return () => {
      mounted = false
    }
  }, [])

  // -----------------------------
  // PROCESS CALLBACK
  // -----------------------------
  const processCallback = async () => {
    console.log('🔍 Callback triggered:', window.location.href)

    // STEP 1 — Check existing session
    setProgressMessage('Đang kiểm tra phiên đăng nhập...')
    const { data } = await supabase.auth.getSession()

    if (data.session) {
      console.log('✅ Found existing session')
      return
    }

    console.log('⏳ No session. Checking OAuth parameters...')

    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    const queryParams = new URLSearchParams(window.location.search)
    const zaloCode = queryParams.get('code')
    const zaloState = queryParams.get('state')
    const zaloErr = queryParams.get('error')

    // -----------------------------
    // SUPABASE OAUTH (Google...)
    // -----------------------------
    if (accessToken) {
      return await handleSupabaseOAuth(accessToken, refreshToken)
    }

    // -----------------------------
    // ZALO OAUTH
    // -----------------------------
    if (zaloCode && zaloState) {
      return await handleZaloOAuth(zaloCode, zaloErr, queryParams)
    }

    // -----------------------------
    // Try again (Supabase sometimes delays)
    // -----------------------------
    await new Promise(r => setTimeout(r, 500))
    const retry = await supabase.auth.getSession()

    if (retry.data.session) {
      console.log('✅ Session established after delay')
      return
    }

    throw new Error('Không tìm thấy thông tin xác thực. Vui lòng thử lại.')
  }

  // -----------------------------
  // HANDLE SUPABASE OAUTH
  // -----------------------------
  const handleSupabaseOAuth = async (accessToken: string | null, refreshToken: string | null) => {
    setProgressMessage('Đang thiết lập phiên đăng nhập...')

    // force Supabase to create session now
    const { error } = await supabase.auth.setSession({
      access_token: accessToken!,
      refresh_token: refreshToken!,
    })

    if (error) throw new Error(`Lỗi OAuth: ${error.message}`)

    // verify session
    const { data } = await supabase.auth.getSession()
    if (!data.session) throw new Error('Không thể tạo phiên đăng nhập')

    console.log('✅ OAuth session created:', data.session.user.email)

    // Clean hash
    window.history.replaceState({}, '', window.location.pathname)

    return true
  }

  // -----------------------------
  // HANDLE ZALO OAUTH
  // -----------------------------
  const handleZaloOAuth = async (code: string, err: string | null, params: URLSearchParams) => {
    setProgressMessage('Đang xác thực với Zalo...')

    if (err) throw new Error(`Lỗi Zalo OAuth: ${err}`)

    const state = params.get('state')
    const storedState = sessionStorage.getItem('zalo_oauth_state')
    if (state !== storedState) throw new Error('Lỗi bảo mật - vui lòng thử lại')

    const verifier = sessionStorage.getItem('zalo_code_verifier')
    if (!verifier) throw new Error('Phiên làm việc hết hạn - vui lòng thử lại')

    // Cleanup
    sessionStorage.removeItem('zalo_oauth_state')
    sessionStorage.removeItem('zalo_code_verifier')

    // Step 1: Exchange code → token
    const tokenRes = await fetch('/api/auth/zalo/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokenData.error)

    const access_token = tokenData.access_token

    // Step 2: Fetch Zalo user
    const userRes = await fetch('/api/auth/zalo/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token }),
    })

    const zaloUser = await userRes.json()
    if (!userRes.ok) throw new Error(zaloUser.error)

    console.log('Zalo user:', zaloUser)

    // Step 3: Login/signup Supabase
    const pseudoEmail = `zalo_${zaloUser.id}@cpls.app`
    const pseudoPass = `zalo_${zaloUser.id}_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 12)}`

    const { data: signInData, error: signInErr } = await authService.signIn({
      email: pseudoEmail,
      password: pseudoPass,
    })

    let session = signInData?.session

    if (signInErr) {
      const { data: signUpData, error: signUpErr } = await authService.signUp({
        email: pseudoEmail,
        password: pseudoPass,
      })
      if (signUpErr) throw new Error(signUpErr.message)
      session = signUpData.session
    }

    if (!session) throw new Error('Không thể tạo phiên đăng nhập')

    // Step 4: Update profile
    await profileService.upsertProfile({
      id: session.user.id,
      email: pseudoEmail,
      full_name: zaloUser.name,
      avatar_url: zaloUser.picture,
      zalo_id: zaloUser.id,
      phone_number: '0000000000',
      membership: 'free',
    })

    return true
  }

  // -----------------------------
  // UI
  // -----------------------------
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
            <h2 className="text-xl font-semibold text-green-500 mb-2">
              Đăng nhập thành công!
            </h2>
            <p className="text-[--muted]">Đang chuyển hướng...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-xl font-semibold text-red-500 mb-2">
              Đăng nhập thất bại
            </h2>
            <p className="text-[--muted] mb-4 whitespace-pre-line">{errorMessage}</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-green-500 p-3 rounded-lg font-bold"
            >
              Thử lại
            </button>
          </>
        )}

      </div>
    </div>
  )
}
