'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        console.error(error)
        alert('Không thể đăng nhập với Google.')
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
      <div className="bg-[--panel] rounded-xl shadow-xl p-8 w-full max-w-md text-center">

        <h2 className="text-2xl font-bold text-[--fg] mb-6">
          Đăng nhập
        </h2>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="
            w-full flex items-center justify-center gap-3
            bg-white text-black border border-gray-300
            hover:bg-gray-100
            rounded-lg p-3 font-semibold shadow
            transition-all
          "
        >
          {loading ? (
            <svg
              className="animate-spin h-5 w-5 text-gray-700"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.3 0 0 5.3 0 12h4z"
              />
            </svg>
          ) : (
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              className="h-5 w-5"
            />
          )}

          {loading ? 'Đang chuyển tiếp...' : 'Đăng nhập với Google'}
        </button>

        <p className="text-[--muted] mt-6 text-sm">
          Bạn sẽ được chuyển hướng đến Google để xác thực.
        </p>
      </div>
    </div>
  )
}
