'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PhoneInput from './PhoneInput'
import OTPInput from './OTPInput'
import { createClient } from '@/lib/supabase/client'

type AuthStep = 'phone' | 'otp'
type AuthPurpose = 'registration' | 'login'

interface PhoneAuthFormProps {
  defaultPurpose?: AuthPurpose
  onSuccess?: () => void
  redirectTo?: string
}

/**
 * Modern phone + OTP authentication form
 * Supports both registration and login flows
 */
export default function PhoneAuthForm({
  defaultPurpose = 'login',
  onSuccess,
  redirectTo = '/dashboard',
}: PhoneAuthFormProps) {
  const router = useRouter()

  // Form state
  const [step, setStep] = useState<AuthStep>('phone')
  const [purpose, setPurpose] = useState<AuthPurpose>(defaultPurpose)
  const [phone, setPhone] = useState('')
  const [otp, setOTP] = useState('')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [mockMode, setMockMode] = useState(false)

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Handle phone number submission
  const handleSendOTP = async () => {
    setError('')

    // Validate phone number
    if (!phone) {
      setError('Vui lòng nhập số điện thoại')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Không thể gửi mã OTP')
        return
      }

      // Success - move to OTP step
      setStep('otp')
      setCountdown(60) // 60 seconds countdown
      setMockMode(data.mockMode || false)

      // If mock mode, show the OTP code in console
      if (data.mockMode) {
        console.log('🧪 MOCK MODE: OTP sent', data)
      }
    } catch (err) {
      console.error('Error sending OTP:', err)
      setError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // Handle OTP verification
  const handleVerifyOTP = async (otpCode: string) => {
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: otpCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Mã OTP không đúng')
        return
      }

      // Success - create Supabase session
      const supabase = createClient()

      if (data.session?.access_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      console.log('✅ Authentication successful:', data.user)

      // Call success callback if provided
      if (onSuccess) {
        onSuccess()
      }

      // Redirect to dashboard
      router.push(redirectTo)
    } catch (err) {
      console.error('Error verifying OTP:', err)
      setError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  // Handle resend OTP
  const handleResendOTP = async () => {
    setOTP('')
    setError('')
    await handleSendOTP()
  }

  // Handle back to phone step
  const handleBackToPhone = () => {
    setStep('phone')
    setOTP('')
    setError('')
    setCountdown(0)
  }

  // Toggle between registration and login
  const togglePurpose = () => {
    setPurpose(purpose === 'login' ? 'registration' : 'login')
    setError('')
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {purpose === 'registration' ? 'Đăng ký tài khoản' : 'Đăng nhập'}
        </h1>
        <p className="text-gray-600">
          {purpose === 'registration'
            ? 'Tạo tài khoản mới với số điện thoại'
            : 'Đăng nhập bằng số điện thoại'}
        </p>
      </div>

      {/* Mock mode warning */}
      {mockMode && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-yellow-600 mt-0.5 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                🧪 Mock Mode
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Zalo ZNS chưa được cấu hình. Check console logs để xem mã OTP.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main form card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        {/* Phone number step */}
        {step === 'phone' && (
          <div className="space-y-6">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              onEnter={handleSendOTP}
              disabled={loading}
              error={error}
              autoFocus
            />

            <button
              onClick={handleSendOTP}
              disabled={loading || !phone}
              className={`
                w-full py-3 px-6 rounded-lg font-medium text-white
                transition-all duration-200 transform
                ${
                  loading || !phone
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }
                focus:outline-none focus:ring-4 focus:ring-blue-100
              `}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Đang gửi...
                </span>
              ) : (
                'Tiếp tục'
              )}
            </button>
          </div>
        )}

        {/* OTP verification step */}
        {step === 'otp' && (
          <div className="space-y-6">
            {/* Back button and phone display */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleBackToPhone}
                disabled={loading}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Quay lại
              </button>
              <span className="text-sm text-gray-600 font-medium">
                {phone}
              </span>
            </div>

            {/* OTP input */}
            <OTPInput
              value={otp}
              onChange={setOTP}
              onComplete={handleVerifyOTP}
              disabled={loading}
              error={error}
            />

            {/* Resend button */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-sm text-gray-500">
                  Gửi lại mã sau{' '}
                  <span className="font-medium text-blue-600">
                    {countdown}s
                  </span>
                </p>
              ) : (
                <button
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  Gửi lại mã OTP
                </button>
              )}
            </div>

            {/* Manual verify button (optional) */}
            {otp.length === 6 && (
              <button
                onClick={() => handleVerifyOTP(otp)}
                disabled={loading}
                className={`
                  w-full py-3 px-6 rounded-lg font-medium text-white
                  transition-all duration-200 transform
                  ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                  }
                  focus:outline-none focus:ring-4 focus:ring-blue-100
                `}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Đang xác thực...
                  </span>
                ) : (
                  'Xác nhận'
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Toggle between login and registration */}
      {step === 'phone' && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {purpose === 'login'
              ? 'Chưa có tài khoản?'
              : 'Đã có tài khoản?'}{' '}
            <button
              onClick={togglePurpose}
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {purpose === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
