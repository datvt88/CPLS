'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { validatePassword } from '@/utils/validation'

export default function PasswordManagement() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [hasPhoneNumber, setHasPhoneNumber] = useState<boolean | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Form states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showPasswords, setShowPasswords] = useState(false)

  useEffect(() => {
    checkPasswordStatus()
  }, [])

  const checkPasswordStatus = async () => {
    setLoading(true)
    setError('')

    try {
      // Add timeout protection (10 seconds)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const userPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: Không thể tải thông tin mật khẩu')), 10000)
      )

      const { data: { user } } = await Promise.race([userPromise, timeoutPromise])

      clearTimeout(timeoutId)

      if (!user) {
        setError('Không tìm thấy thông tin người dùng')
        setLoading(false)
        return
      }

      // Check if user has password set
      // This can be via:
      // 1. Email provider (user signed up with email+password)
      // 2. user_metadata.has_password flag (set when password is set via admin API)
      const providers = user.app_metadata?.providers || []
      const hasEmailProvider = providers.includes('email')
      const hasPasswordFlag = user.user_metadata?.has_password === true
      
      setHasPassword(hasEmailProvider || hasPasswordFlag)

      // Check if user has phone number in profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .single()
      
      setHasPhoneNumber(!!profile?.phone_number && profile.phone_number.trim() !== '')
      setError('')
    } catch (err: any) {
      console.error('Error checking password status:', err)
      setError(err.message?.includes('Timeout')
        ? 'Không thể kết nối. Vui lòng kiểm tra kết nối mạng và thử lại.'
        : 'Không thể tải thông tin mật khẩu. Vui lòng thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    // Validate new password
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      setMessage(passwordValidation.error || 'Mật khẩu không hợp lệ')
      return
    }

    // Check password confirmation
    if (newPassword !== confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp')
      return
    }

    // If user has password, require current password
    if (hasPassword && !currentPassword) {
      setMessage('Vui lòng nhập mật khẩu hiện tại')
      return
    }

    setSaving(true)

    try {
      // Get the current session for authorization
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.')
      }

      // Use server-side API to set password (works for all auth providers)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const response = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ newPassword }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Không thể cập nhật mật khẩu')
      }

      if (hasPassword) {
        setMessage('Cập nhật mật khẩu thành công!')
      } else {
        setMessage('Thiết lập mật khẩu thành công! Bạn có thể đăng nhập bằng số điện thoại và mật khẩu.')
        setHasPassword(true)
      }

      // Reset form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowForm(false)

      // Refresh password status
      await checkPasswordStatus()
    } catch (error: any) {
      console.error('Error updating password:', error)
      if (error.name === 'AbortError' || error.message?.includes('Timeout')) {
        setMessage('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.')
      } else {
        setMessage(error.message || 'Có lỗi xảy ra khi cập nhật mật khẩu')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-lg shadow-lg p-6">
        <div className="flex flex-col items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400 text-sm">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[--fg] mb-2">Không thể tải thông tin</h3>
          <p className="text-red-400 mb-6">{error}</p>
          <button
            onClick={checkPasswordStatus}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[--fg]">Mật khẩu đăng nhập</h2>
          <p className="text-[--muted] text-sm mt-1">
            Quản lý mật khẩu để đăng nhập bằng số điện thoại
          </p>
        </div>
        {hasPassword && (
          <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
            ✓ Đã thiết lập
          </span>
        )}
      </div>

      {/* Phone number warning */}
      {hasPhoneNumber === false && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ Bạn chưa cập nhật số điện thoại. Vui lòng cập nhật số điện thoại trong phần &quot;Thông Tin Hồ Sơ&quot; ở trên trước khi thiết lập mật khẩu.
          </p>
        </div>
      )}

      {/* Status */}
      <div className="mb-4 p-3 bg-[--bg] rounded-lg">
        <p className="text-[--muted] text-sm">
          {hasPassword
            ? '✅ Bạn đã thiết lập mật khẩu và có thể đăng nhập bằng số điện thoại + mật khẩu'
            : '⚠️ Bạn chưa thiết lập mật khẩu. Thiết lập ngay để có thể đăng nhập bằng số điện thoại'
          }
        </p>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          disabled={!hasPhoneNumber}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {hasPassword ? 'Thay đổi mật khẩu mới' : 'Thiết lập mật khẩu'}
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                Mật khẩu hiện tại <span className="text-red-500">*</span>
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg] transition-all"
                placeholder="Nhập mật khẩu hiện tại"
                disabled={saving}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-[--fg] text-sm font-medium mb-2">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg] transition-all"
              placeholder="Nhập mật khẩu mới"
              disabled={saving}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Tối thiểu 6 ký tự, nên có chữ hoa, chữ thường và số
            </p>
          </div>

          <div>
            <label className="block text-[--fg] text-sm font-medium mb-2">
              Xác nhận mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg] transition-all"
              placeholder="Nhập lại mật khẩu mới"
              disabled={saving}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showPasswords"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-[--bg] border-gray-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="showPasswords" className="text-sm text-[--muted]">
              Hiện mật khẩu
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang lưu...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {hasPassword ? 'Cập nhật mật khẩu mới' : 'Thiết lập mật khẩu'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
                setMessage('')
              }}
              disabled={saving}
              className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>
          </div>

          {message && (
            <div
              className={`p-4 rounded-lg text-center font-medium ${
                message.includes('thành công')
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                  : 'bg-red-500/20 text-red-400 border border-red-500/50'
              }`}
            >
              {message}
            </div>
          )}
        </form>
      )}
    </div>
  )
}
