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

  useEffect(() => {
    handleCallback()
  }, [])

  const handleCallback = async () => {
    try {
      console.log('🔍 Callback page loaded')
      console.log('URL:', window.location.href)
      console.log('Hash:', window.location.hash)
      console.log('Search:', window.location.search)

      // STEP 1: Check if Supabase already has a session (auto-restored from storage)
      const { data: { session: existingSession } } = await supabase.auth.getSession()

      if (existingSession) {
        console.log('✅ Found existing session:', existingSession.user.email)
        setStatus('success')
        setTimeout(() => {
          router.push('/dashboard')
        }, 1000)
        return
      }

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

      // Handle Supabase OAuth (Google, etc.)
      if (accessToken) {
        console.log('🔑 Processing Supabase OAuth (Google)')
        await handleSupabaseOAuth(accessToken, refreshToken)
        return
      }

      // Handle Zalo OAuth - must have both code AND state
      if (code && state) {
        console.log('🔑 Processing Zalo OAuth')
        await handleZaloOAuth(code, queryError, urlParams)
        return
      }

      // Handle Zalo OAuth error
      if (queryError && state) {
        throw new Error(`Zalo OAuth error: ${queryError}`)
      }

      // STEP 5: If no valid OAuth parameters, try to get session one more time
      // (Sometimes Supabase takes a moment to process the callback)
      console.log('⏳ Waiting for Supabase to process callback...')
      await new Promise(resolve => setTimeout(resolve, 1000))

      const { data: { session: delayedSession } } = await supabase.auth.getSession()

      if (delayedSession) {
        console.log('✅ Session established after delay')
        setStatus('success')
        setTimeout(() => {
          router.push('/dashboard')
        }, 500)
        return
      }

      // No valid authentication found
      console.error('❌ No valid authentication parameters found')
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
      console.log('🔐 Setting up Supabase session...')

      // Supabase client will automatically pick up the session from URL hash
      // We need to call setSession explicitly to ensure it's processed
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          throw new Error(`Failed to set session: ${error.message}`)
        }

        console.log('✅ Session set successfully')
      }

      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(`OAuth error: ${sessionError.message}`)
      }

      if (!session) {
        throw new Error('No session found after OAuth callback')
      }

      console.log('✅ Google OAuth session established:', {
        user_id: session.user.id,
        email: session.user.email,
        provider: session.user.app_metadata.provider,
      })

      // Profile will be auto-created/updated by AuthListener component
      // and database trigger (handle_new_user function)

      setStatus('success')

      // Clean up URL hash
      window.history.replaceState({}, document.title, window.location.pathname)

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      console.error('❌ Supabase OAuth error:', error)
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
      console.log('🔐 Processing Zalo OAuth...')

      // Check for OAuth errors
      if (error) {
        throw new Error(`Zalo OAuth error: ${error}`)
      }

      if (!code) {
        throw new Error('Không nhận được authorization code từ Zalo')
      }

      const state = urlParams.get('state')

      // Verify CSRF state parameter
      const storedState = sessionStorage.getItem('zalo_oauth_state')
      if (state !== storedState) {
        throw new Error('Invalid state parameter - possible CSRF attack')
      }

      // Get stored PKCE code verifier
      const codeVerifier = sessionStorage.getItem('zalo_code_verifier')
      if (!codeVerifier) {
        throw new Error('Code verifier not found - possible session issue')
      }

      // Clean up stored state and verifier
      sessionStorage.removeItem('zalo_oauth_state')
      sessionStorage.removeItem('zalo_code_verifier')

      console.log('📤 Exchanging code for token...')

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
        throw new Error(errorData.error || 'Failed to exchange authorization code')
      }

      const { access_token } = await tokenResponse.json()
      console.log('✅ Token received')

      console.log('👤 Fetching user info...')

      // Step 2: Get user info from Zalo (server-side)
      const userResponse = await fetch('/api/auth/zalo/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token }),
      })

      if (!userResponse.ok) {
        const errorData = await userResponse.json()
        throw new Error(errorData.error || 'Failed to get user info from Zalo')
      }

      const zaloUser = await userResponse.json()

      console.log('✅ Zalo user data received:', {
        id: zaloUser.id,
        name: zaloUser.name,
        has_picture: !!zaloUser.picture,
      })

      // Step 3: Create/sign in user with Supabase
      const pseudoEmail = `zalo_${zaloUser.id}@cpls.app`

      console.log('🔐 Creating/signing in Supabase user...')

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
        throw new Error('Failed to create session')
      }

      console.log('💾 Updating profile...')

      // Step 4: Create/update profile with Zalo data
      const { profile } = await profileService.getProfile(session.user.id)

      const placeholderPhone = '0000000000'

      if (profile) {
        const updateData: any = {
          full_name: zaloUser.name,
          avatar_url: zaloUser.picture,
        }

        if (zaloUser.birthday) updateData.birthday = zaloUser.birthday
        if (zaloUser.gender) updateData.gender = zaloUser.gender

        if (!profile.phone_number || profile.phone_number === '0000000000') {
          updateData.phone_number = placeholderPhone
        }

        await profileService.linkZaloAccount(
          session.user.id,
          zaloUser.id,
          updateData
        )
      } else {
        await profileService.upsertProfile({
          id: session.user.id,
          email: pseudoEmail,
          phone_number: placeholderPhone,
          full_name: zaloUser.name,
          avatar_url: zaloUser.picture,
          birthday: zaloUser.birthday,
          gender: zaloUser.gender,
          zalo_id: zaloUser.id,
          membership: 'free',
        })
      }

      console.log('✅ Profile updated')
      setStatus('success')

      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
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
            <p className="text-[--muted]">Vui lòng đợi trong giây lát</p>
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
            <p className="text-[--muted] mb-4">{errorMessage}</p>
            <p className="text-sm text-[--muted]">Đang chuyển về trang đăng nhập...</p>
          </>
        )}
      </div>
    </div>
  )
}
