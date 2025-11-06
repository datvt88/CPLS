'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
      // Get session after OAuth redirect
      const { session, error: sessionError } = await authService.handleOAuthCallback()

      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'Không thể xác thực. Vui lòng thử lại.')
      }

      // Get user metadata from OAuth provider
      const { metadata, error: metadataError } = await authService.getUserMetadata()

      if (!metadataError && metadata) {
        // Check if profile exists
        const { profile } = await profileService.getProfile(session.user.id)

        if (profile && metadata.providerId) {
          // Update existing profile with OAuth data
          await profileService.linkZaloAccount(
            session.user.id,
            metadata.providerId,
            {
              full_name: metadata.fullName,
              phone_number: metadata.phoneNumber,
              avatar_url: metadata.avatarUrl,
            }
          )
        } else if (!profile) {
          // Create new profile for OAuth user
          await profileService.upsertProfile({
            id: session.user.id,
            email: session.user.email || metadata.email || '',
            full_name: metadata.fullName,
            phone_number: metadata.phoneNumber,
            avatar_url: metadata.avatarUrl,
            zalo_id: metadata.providerId,
            membership: 'free',
          })
        }
      }

      setStatus('success')

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      console.error('Auth callback error:', error)
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Đã xảy ra lỗi')

      // Redirect to login page after error
      setTimeout(() => {
        router.push('/login')
      }, 3000)
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
                className="h-12 w-12 text-[--success] mx-auto"
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
                className="h-12 w-12 text-[--danger] mx-auto"
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
