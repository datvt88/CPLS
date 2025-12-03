'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [progressMessage, setProgressMessage] = useState<string>('Đang kiểm tra phiên đăng nhập...')

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    const runCallback = async () => {
      try {
        await handleCallback()
      } catch (error) {
        if (!mounted) return
        console.error('❌ Unhandled error in handleCallback:', error)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định')
        setTimeout(() => {
          if (mounted) router.push('/login')
        }, 3000)
      }
    }

    // Set a timeout to prevent hanging indefinitely (reduced from 15s to 8s)
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.error('❌ Auth callback timeout (8s) - redirecting to login')
        setStatus('error')
        setErrorMessage('Xác thực hết thời gian chờ. Vui lòng thử lại.')
        setTimeout(() => {
          if (mounted) router.push('/login')
        }, 2000)
      }
    }, 8000) // 8 second timeout (reduced from 15s)

    runCallback()

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [])

  const handleCallback = async () => {
    try {
      console.log('🔍 [Callback] Page loaded at', new Date().toISOString())
      console.log('URL:', window.location.href)
      console.log('Hash:', window.location.hash)
      console.log('Search:', window.location.search)

      // STEP 1: Check if Supabase already has a session (auto-restored from storage)
      console.log('⏳ [Callback] Step 1: Checking for existing session...')
      setProgressMessage('Đang kiểm tra phiên đăng nhập...')

      const { data: { session: existingSession }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('❌ [Callback] Error getting session:', sessionError)
        throw new Error(`Lỗi phiên đăng nhập: ${sessionError.message}`)
      }

      if (existingSession) {
        console.log('✅ [Callback] Found existing session:', existingSession.user.email)
        setProgressMessage('Đã tìm thấy phiên đăng nhập!')
        setStatus('success')
        setTimeout(() => {
          console.log('🚀 [Callback] Redirecting to dashboard...')
          router.push('/dashboard')
        }, 500) // Reduced from 1000ms to 500ms
        return
      }

      console.log('ℹ️ [Callback] No existing session found, checking OAuth parameters...')
      setProgressMessage('Đang xử lý xác thực...')

      // STEP 2: Check for Supabase OAuth hash fragments
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const errorDescription = hashParams.get('error_description')
      const hashError = hashParams.get('error')

      // Handle OAuth error in hash
      if (hashError) {
        throw new Error(`OAuth error: ${errorDescription || hashError}`)
      }

      // STEP 3: Check for Zalo OAuth query parameters
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      const queryError = urlParams.get('error')

      console.log('Parameters:', {
        hasAccessToken: !!accessToken,
        hasCode: !!code,
        hasState: !!state,
        hasError: !!queryError
      })

      // STEP 4: Route to appropriate handler

      // Handle Supabase OAuth (Google, etc.) - Implicit flow with access_token in hash
      if (accessToken) {
        console.log('🔑 [Callback] Processing Supabase OAuth (Google) - Implicit flow')
        setProgressMessage('Đang xác thực với Google...')
        await handleSupabaseOAuth(accessToken, refreshToken)
        return
      }

      // Handle Supabase PKCE flow - code without state (Google OAuth with PKCE)
      if (code && !state) {
        console.log('🔑 [Callback] Processing Supabase PKCE OAuth')
        setProgressMessage('Đang xử lý xác thực...')
        await handleSupabasePKCE(code)
        return
      }

      // Handle Zalo OAuth - must have both code AND state
      if (code && state) {
        console.log('🔑 [Callback] Processing Zalo OAuth')
        setProgressMessage('Đang xác thực với Zalo...')
        await handleZaloOAuth(code, queryError, urlParams)
        return
      }

      // Handle OAuth error
      if (queryError) {
        throw new Error(`Lỗi OAuth: ${queryError}`)
      }

      // STEP 5: If no valid OAuth parameters, try to get session one more time
      // (Sometimes Supabase takes a moment to process the callback)
      console.log('⏳ [Callback] Waiting for Supabase to process callback...')
      setProgressMessage('Đang hoàn tất xác thực...')
      await new Promise(resolve => setTimeout(resolve, 500)) // Reduced from 1000ms to 500ms

      const { data: { session: delayedSession } } = await supabase.auth.getSession()

      if (delayedSession) {
        console.log('✅ [Callback] Session established after delay')
        setProgressMessage('Xác thực thành công!')
        setStatus('success')
        setTimeout(() => {
          router.push('/dashboard')
        }, 300) // Reduced from 500ms to 300ms
        return
      }

      // No valid authentication found
      console.error('❌ [Callback] No valid authentication parameters found')
      throw new Error('Không tìm thấy thông tin xác thực. Vui lòng thử lại.')

    } catch (error) {
      console.error('❌ Auth callback error:', error)
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định')

      // Redirect to login page after error
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    }
  }

  /**
   * Handle Supabase OAuth callback (Google, GitHub, etc.)
   * Supabase automatically handles the session via hash fragments
   */
  const handleSupabaseOAuth = async (accessToken: string | null, refreshToken: string | null) => {
    try {
      console.log('🔐 [OAuth] Setting up Supabase session...')
      setProgressMessage('Đang thiết lập phiên đăng nhập...')

      // Supabase client will automatically pick up the session from URL hash
      // We need to call setSession explicitly to ensure it's processed
      if (accessToken && refreshToken) {
        console.log('⏳ [OAuth] Calling setSession with tokens...')
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          console.error('❌ [OAuth] setSession error:', error)
          throw new Error(`Không thể tạo phiên đăng nhập: ${error.message}`)
        }

        console.log('✅ [OAuth] Session set successfully:', data.session?.user.email)
      } else {
        console.warn('⚠️ [OAuth] Missing tokens - attempting to get existing session')
      }

      // Get the current session
      console.log('⏳ [OAuth] Getting current session...')
      setProgressMessage('Đang xác nhận phiên đăng nhập...')
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('❌ [OAuth] getSession error:', sessionError)
        throw new Error(`Lỗi OAuth: ${sessionError.message}`)
      }

      if (!session) {
        console.error('❌ [OAuth] No session found after OAuth callback')
        throw new Error('Không thể tạo phiên đăng nhập. Vui lòng thử lại.')
      }

      console.log('✅ [OAuth] Session established:', {
        user_id: session.user.id,
        email: session.user.email,
        provider: session.user.app_metadata.provider,
      })

      // Profile will be auto-created/updated by AuthListener component
      // and database trigger (handle_new_user function)

      console.log('✅ [OAuth] Setting status to success')
      setProgressMessage('Đăng nhập thành công!')
      setStatus('success')

      // Clean up URL hash
      window.history.replaceState({}, document.title, window.location.pathname)

      // Redirect to dashboard (reduced delay from 1500ms to 500ms)
      console.log('🚀 [OAuth] Redirecting to dashboard...')
      setTimeout(() => {
        router.push('/dashboard')
      }, 500)
    } catch (error) {
      console.error('❌ Supabase OAuth error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      throw error
    }
  }

  /**
   * Handle Supabase PKCE OAuth callback
   * Exchanges authorization code for session tokens
   */
  const handleSupabasePKCE = async (code: string) => {
    try {
      console.log('🔐 [PKCE] Processing Supabase PKCE OAuth...')
      setProgressMessage('Đang xử lý xác thực...')

      // Exchange code for session using Supabase's built-in PKCE flow
      console.log('⏳ [PKCE] Exchanging code for session...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('❌ [PKCE] Code exchange error:', error)
        throw new Error(`Không thể xác thực: ${error.message}`)
      }

      if (!data.session) {
        console.error('❌ [PKCE] No session returned after code exchange')
        throw new Error('Không thể tạo phiên đăng nhập. Vui lòng thử lại.')
      }

      console.log('✅ [PKCE] Session established:', {
        user_id: data.session.user.id,
        email: data.session.user.email,
        provider: data.session.user.app_metadata.provider,
      })

      // Profile will be auto-created/updated by AuthListener component
      // and database trigger (handle_new_user function)

      console.log('✅ [PKCE] Setting status to success')
      setProgressMessage('Đăng nhập thành công!')
      setStatus('success')

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)

      // Redirect to dashboard
      console.log('🚀 [PKCE] Redirecting to dashboard...')
      setTimeout(() => {
        router.push('/dashboard')
      }, 500)
    } catch (error) {
      console.error('❌ Supabase PKCE error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      throw error
    }
  }

  /**
   * Handle Zalo OAuth callback
   * Uses custom code exchange flow
   */
  const handleZaloOAuth = async (
    code: string | null,
    error: string | null,
    urlParams: URLSearchParams
  ) => {
    try {
      console.log('🔐 [Zalo] Processing Zalo OAuth...')
      setProgressMessage('Đang xác thực với Zalo...')

      // Check for OAuth errors
      if (error) {
        throw new Error(`Lỗi Zalo OAuth: ${error}`)
      }

      if (!code) {
        throw new Error('Không nhận được mã xác thực từ Zalo')
      }

      const state = urlParams.get('state')

      // Verify CSRF state parameter
      const storedState = sessionStorage.getItem('zalo_oauth_state')
      if (state !== storedState) {
        throw new Error('Lỗi bảo mật - vui lòng thử lại')
      }

      // Get stored PKCE code verifier
      const codeVerifier = sessionStorage.getItem('zalo_code_verifier')
      if (!codeVerifier) {
        throw new Error('Phiên làm việc hết hạn - vui lòng thử lại')
      }

      // Clean up stored state and verifier
      sessionStorage.removeItem('zalo_oauth_state')
      sessionStorage.removeItem('zalo_code_verifier')

      console.log('📤 [Zalo] Exchanging code for token...')
      setProgressMessage('Đang lấy token xác thực...')

      // Step 1: Exchange authorization code for access token (server-side)
      const tokenResponse = await fetch('/api/auth/zalo/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
        }),
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        throw new Error(errorData.error || 'Không thể lấy token từ Zalo')
      }

      const { access_token } = await tokenResponse.json()
      console.log('✅ [Zalo] Token received')

      console.log('👤 [Zalo] Fetching user info...')
      setProgressMessage('Đang lấy thông tin người dùng...')

      // Step 2: Get user info from Zalo (server-side)
      const userResponse = await fetch('/api/auth/zalo/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token }),
      })

      if (!userResponse.ok) {
        const errorData = await userResponse.json()
        throw new Error(errorData.error || 'Không thể lấy thông tin từ Zalo')
      }

      const zaloUser = await userResponse.json()

      console.log('✅ [Zalo] User data received:', {
        id: zaloUser.id,
        name: zaloUser.name,
      })

      // Step 3: Create/sign in user with Supabase
      const pseudoEmail = `zalo_${zaloUser.id}@cpls.app`

      console.log('🔐 [Zalo] Creating/signing in Supabase user...')
      setProgressMessage('Đang tạo phiên đăng nhập...')

      // Try to sign in first
      let session
      const { data: signInData, error: signInError } = await authService.signIn({
        email: pseudoEmail,
        password: `zalo_${zaloUser.id}_secure_password_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10)}`,
      })

      if (signInError) {
        console.log('User not found, creating new account...')
        // User doesn't exist, create new account
        const { data: signUpData, error: signUpError } = await authService.signUp({
          email: pseudoEmail,
          password: `zalo_${zaloUser.id}_secure_password_${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10)}`,
        })

        if (signUpError) {
          throw new Error(`Failed to create user: ${signUpError.message}`)
        }

        session = signUpData.session
      } else {
        console.log('✅ User signed in')
        session = signInData.session
      }

      if (!session) {
        throw new Error('Không thể tạo phiên đăng nhập')
      }

      console.log('💾 [Zalo] Updating profile...')
      setProgressMessage('Đang cập nhật thông tin...')

      // Step 4: Create/update profile with Zalo data
      const { profile } = await profileService.getProfile(session.user.id)

      if (profile) {
        const updateData: any = {
          full_name: zaloUser.name,
          avatar_url: zaloUser.picture,
        }

        if (zaloUser.birthday) updateData.birthday = zaloUser.birthday
        if (zaloUser.gender) updateData.gender = zaloUser.gender
        // Note: phone_number is optional for OAuth users
        // Only update if provided by Zalo
        if (zaloUser.phone) updateData.phone_number = zaloUser.phone

        await profileService.linkZaloAccount(
          session.user.id,
          zaloUser.id,
          updateData
        )
      } else {
        await profileService.upsertProfile({
          id: session.user.id,
          email: pseudoEmail,
          phone_number: zaloUser.phone || null, // Allow null for OAuth users
          full_name: zaloUser.name,
          avatar_url: zaloUser.picture,
          birthday: zaloUser.birthday,
          gender: zaloUser.gender,
          zalo_id: zaloUser.id,
          membership: 'free',
        })
      }

      console.log('✅ [Zalo] Profile updated successfully')
      setProgressMessage('Đăng nhập thành công!')
      setStatus('success')

      setTimeout(() => {
        router.push('/dashboard')
      }, 500) // Reduced from 1500ms to 500ms
    } catch (error) {
      console.error('❌ Zalo OAuth error:', error)
      throw error
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
      <div className="bg-[--panel] rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="mb-4">
              <svg
                className="animate-spin h-12 w-12 text-[--accent] mx-auto"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đang xác thực...
            </h2>
            <p className="text-[--muted]">{progressMessage}</p>
            <div className="mt-4 w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[--accent] h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-4">
              <svg
                className="h-12 w-12 text-green-500 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thành công!
            </h2>
            <p className="text-[--muted]">Đang chuyển hướng đến dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-4">
              <svg
                className="h-12 w-12 text-red-500 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[--fg] mb-2">
              Đăng nhập thất bại
            </h2>
            <p className="text-[--muted] mb-4 whitespace-pre-line">{errorMessage}</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 transition-all rounded-lg p-3 text-black font-bold shadow-lg"
            >
              Thử lại
            </button>
          </>
        )}
      </div>
    </div>
  )
}
