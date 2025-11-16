'use client'

import { useState } from 'react'
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'
import { useRouter } from 'next/navigation'

interface RegisterFormProps {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<'info' | 'otp' | 'complete'>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Form data
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
  })

  // OTP state
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpExpiry, setOtpExpiry] = useState<number>(0)
  const [debugOtp, setDebugOtp] = useState<string>('')

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
  }

  // Step 1: Send OTP to phone number
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.phoneNumber) {
      setError('Vui lòng nhập số điện thoại')
      return
    }

    if (!formData.email || !formData.password) {
      setError('Vui lòng nhập đầy đủ thông tin')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    setLoading(true)

    try {
      // Send OTP via ZNS API
      const response = await fetch('/api/zns/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formData.phoneNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Không thể gửi mã OTP')
      }

      setOtpSent(true)
      setOtpExpiry(data.expires_at)
      setStep('otp')

      // DEBUG ONLY - Remove in production
      if (data.debug_otp) {
        setDebugOtp(data.debug_otp)
        console.log('🔍 DEBUG OTP:', data.debug_otp)
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi gửi mã OTP')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP and create account
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!otp || otp.length !== 6) {
      setError('Vui lòng nhập mã OTP 6 số')
      return
    }

    setLoading(true)

    try {
      // Verify OTP
      const verifyResponse = await fetch('/api/zns/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: formData.phoneNumber,
          otp: otp,
        }),
      })

      const verifyData = await verifyResponse.json()

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Mã OTP không hợp lệ')
      }

      // OTP verified, create Supabase account
      const { data: signUpData, error: signUpError } = await authService.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (signUpError) {
        throw new Error(signUpError.message || 'Không thể tạo tài khoản')
      }

      if (!signUpData.user) {
        throw new Error('Không thể tạo tài khoản')
      }

      // Create profile
      await profileService.upsertProfile({
        id: signUpData.user.id,
        email: formData.email,
        phone_number: formData.phoneNumber,
        full_name: formData.fullName || 'User',
        membership: 'free',
      })

      setStep('complete')

      // Redirect to dashboard after short delay
      setTimeout(() => {
        onSuccess?.()
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi xác thực')
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOTP = async () => {
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/zns/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: formData.phoneNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Không thể gửi lại mã OTP')
      }

      setOtpExpiry(data.expires_at)

      // DEBUG ONLY
      if (data.debug_otp) {
        setDebugOtp(data.debug_otp)
        console.log('🔍 DEBUG OTP:', data.debug_otp)
      }
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Step 1: Registration Info */}
      {step === 'info' && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <h2 className="text-2xl font-bold text-[--fg] mb-6">Đăng ký tài khoản</h2>

          {error && (
            <div className="p-3 bg-red-900/30 border-l-4 border-red-500 rounded">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[--fg] mb-1">
              Họ và tên
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-lg bg-[--panel] border border-gray-700 text-[--fg] focus:border-blue-500 focus:outline-none"
              placeholder="Nguyễn Văn A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--fg] mb-1">
              Số điện thoại *
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg bg-[--panel] border border-gray-700 text-[--fg] focus:border-blue-500 focus:outline-none"
              placeholder="0912345678"
            />
            <p className="text-xs text-[--muted] mt-1">
              Mã OTP sẽ được gửi qua Zalo ZNS
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[--fg] mb-1">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg bg-[--panel] border border-gray-700 text-[--fg] focus:border-blue-500 focus:outline-none"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--fg] mb-1">
              Mật khẩu *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg bg-[--panel] border border-gray-700 text-[--fg] focus:border-blue-500 focus:outline-none"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[--fg] mb-1">
              Xác nhận mật khẩu *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-lg bg-[--panel] border border-gray-700 text-[--fg] focus:border-blue-500 focus:outline-none"
              placeholder="Nhập lại mật khẩu"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
          </button>

          <div className="text-center text-sm">
            <span className="text-[--muted]">Đã có tài khoản? </span>
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-blue-500 hover:text-blue-400"
            >
              Đăng nhập ngay
            </button>
          </div>
        </form>
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <h2 className="text-2xl font-bold text-[--fg] mb-2">Xác thực OTP</h2>
          <p className="text-[--muted] mb-6">
            Mã OTP đã được gửi đến số điện thoại {formData.phoneNumber}
          </p>

          {error && (
            <div className="p-3 bg-red-900/30 border-l-4 border-red-500 rounded">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {debugOtp && (
            <div className="p-3 bg-yellow-900/30 border-l-4 border-yellow-500 rounded">
              <p className="text-yellow-200 text-sm">
                🔍 DEBUG MODE - OTP: <strong>{debugOtp}</strong>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[--fg] mb-1">
              Nhập mã OTP
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                setOtp(value)
                setError('')
              }}
              maxLength={6}
              className="w-full px-4 py-3 text-center text-2xl tracking-widest rounded-lg bg-[--panel] border border-gray-700 text-[--fg] focus:border-blue-500 focus:outline-none"
              placeholder="000000"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang xác thực...' : 'Xác thực OTP'}
          </button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={loading}
              className="text-blue-500 hover:text-blue-400 text-sm disabled:opacity-50"
            >
              Gửi lại mã OTP
            </button>

            <div>
              <button
                type="button"
                onClick={() => setStep('info')}
                className="text-[--muted] hover:text-[--fg] text-sm"
              >
                ← Quay lại
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[--fg]">Đăng ký thành công!</h2>
          <p className="text-[--muted]">
            Đang chuyển hướng đến dashboard...
          </p>
        </div>
      )}
    </div>
  )
}
