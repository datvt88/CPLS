'use client'

import { useState } from 'react'

interface ZaloLoginButtonProps {
  onSuccess?: () => void
  onError?: (error: Error) => void
  className?: string
  fullWidth?: boolean
}

export default function ZaloLoginButton({
  onSuccess,
  onError,
  className = '',
  fullWidth = true,
}: ZaloLoginButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleZaloLogin = async () => {
    try {
      setLoading(true)

      // Get Zalo authorization URL from our API (secure, doesn't expose secrets)
      const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID

      if (!appId) {
        throw new Error('Zalo App ID not configured')
      }

      // Build Zalo OAuth URL - redirect directly to Zalo
      const redirectUri = `${window.location.origin}/auth/callback`
      const state = generateState() // CSRF protection

      // Store state in sessionStorage for verification in callback
      sessionStorage.setItem('zalo_oauth_state', state)

      const authUrl = new URL('https://oauth.zaloapp.com/v4/permission')
      authUrl.searchParams.set('app_id', appId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('state', state)

      // Redirect to Zalo OAuth
      window.location.href = authUrl.toString()

      // Will redirect, so this won't be reached normally
      onSuccess?.()
    } catch (error) {
      console.error('Zalo login error:', error)
      onError?.(error as Error)
      setLoading(false)
    }
  }

  const generateState = (): string => {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15)
  }

  return (
    <button
      type="button"
      onClick={handleZaloLogin}
      disabled={loading}
      className={`
        flex items-center justify-center gap-3 px-4 py-3
        bg-blue-600 hover:bg-blue-700
        text-white font-medium rounded-lg
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Đang kết nối...</span>
        </span>
      ) : (
        <>
          {/* Zalo Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect width="48" height="48" rx="24" fill="white"/>
            <path
              d="M24 8C15.163 8 8 14.611 8 22.667c0 4.803 2.544 9.115 6.44 11.957l-1.423 5.147a.6.6 0 00.848.684l5.835-3.116c1.365.36 2.802.551 4.3.551 8.837 0 16-6.611 16-14.667S32.837 8 24 8z"
              fill="#0068FF"
            />
            <path
              d="M19.5 21.5h-3a.5.5 0 000 1h3a.5.5 0 000-1zM31.5 21.5h-8a.5.5 0 000 1h8a.5.5 0 000-1zM28.5 25.5h-5a.5.5 0 000 1h5a.5.5 0 000-1zM19.5 25.5h-3a.5.5 0 000 1h3a.5.5 0 000-1z"
              fill="white"
            />
          </svg>
          <span>Đăng nhập với Zalo</span>
        </>
      )}
    </button>
  )
}
