'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'
import ProtectedRoute from '@/components/ProtectedRoute'

function ProfilePageContent() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTCBS, setSavingTCBS] = useState(false)
  const [message, setMessage] = useState('')
  const [tcbsMessage, setTCBSMessage] = useState('')

  // User Info Form fields
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [stockAccountNumber, setStockAccountNumber] = useState('')

  // TCBS fields
  const [tcbsApiKey, setTCBSApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { user } = await authService.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { profile: userProfile, error } = await profileService.getProfile(user.id)
      if (error) {
        console.error('Error loading profile:', error)
        setMessage('Không thể tải thông tin')
      } else if (userProfile) {
        setProfile(userProfile)
        setFullName(userProfile.full_name || '')
        setPhoneNumber(userProfile.phone_number || '')
        setStockAccountNumber(userProfile.stock_account_number || '')
        setTCBSApiKey(userProfile.tcbs_api_key || '')
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitUserInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)

    try {
      const { user } = await authService.getUser()
      if (!user) return

      const { error } = await profileService.updateProfile(user.id, {
        full_name: fullName.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        stock_account_number: stockAccountNumber.trim() || undefined,
      })

      if (error) {
        setMessage('Lỗi khi cập nhật: ' + error.message)
      } else {
        setMessage('Cập nhật thành công!')
        await loadProfile()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage('Đã xảy ra lỗi khi cập nhật')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitTCBS = async (e: React.FormEvent) => {
    e.preventDefault()
    setTCBSMessage('')
    setSavingTCBS(true)

    try {
      const { user } = await authService.getUser()
      if (!user) return

      if (!tcbsApiKey.trim()) {
        setTCBSMessage('Vui lòng nhập API Key')
        setSavingTCBS(false)
        return
      }

      const { error } = await profileService.updateTCBSApiKey(user.id, tcbsApiKey.trim())

      if (error) {
        setTCBSMessage('Lỗi khi lưu API Key: ' + error.message)
      } else {
        setTCBSMessage('Lưu API Key thành công!')
        await loadProfile()
      }
    } catch (error) {
      console.error('Error saving TCBS API key:', error)
      setTCBSMessage('Đã xảy ra lỗi khi lưu')
    } finally {
      setSavingTCBS(false)
    }
  }

  const handleRemoveTCBS = async () => {
    if (!confirm('Bạn có chắc muốn xóa kết nối TCBS?')) return

    setTCBSMessage('')
    setSavingTCBS(true)

    try {
      const { user } = await authService.getUser()
      if (!user) return

      const { error } = await profileService.removeTCBSApiKey(user.id)

      if (error) {
        setTCBSMessage('Lỗi khi xóa: ' + error.message)
      } else {
        setTCBSMessage('Đã xóa kết nối TCBS')
        setTCBSApiKey('')
        await loadProfile()
      }
    } catch (error) {
      console.error('Error removing TCBS:', error)
      setTCBSMessage('Đã xảy ra lỗi')
    } finally {
      setSavingTCBS(false)
    }
  }

  const getMembershipBadge = () => {
    if (!profile) return null

    const isPremium = profile.membership === 'premium'
    const badgeClass = isPremium
      ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
      : 'bg-gray-700 text-gray-300'

    let expiryText = ''
    if (isPremium && profile.membership_expires_at) {
      const expiryDate = new Date(profile.membership_expires_at)
      const isExpired = expiryDate < new Date()
      if (!isExpired) {
        expiryText = ` (đến ${expiryDate.toLocaleDateString('vi-VN')})`
      }
    }

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badgeClass}`}>
        {isPremium ? '⭐ Premium' : 'Free'}{expiryText}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg]">
        <div className="text-[--muted]">Đang tải...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--bg] p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-[--fg]">Cá nhân</h1>
          {getMembershipBadge()}
        </div>

        {/* Section 1: Thông tin người dùng */}
        <div className="bg-[--panel] rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[--border]">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[--accent] flex items-center justify-center text-white text-2xl font-bold">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="text-[--fg] font-semibold text-lg">{profile?.email}</p>
              <p className="text-[--muted] text-sm">
                Tham gia: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'N/A'}
              </p>
              {profile?.zalo_id && (
                <p className="text-[--muted] text-sm flex items-center gap-1 mt-1">
                  <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="24" fill="#0068FF"/>
                  </svg>
                  Đã liên kết với Zalo
                </p>
              )}
            </div>
          </div>

          <h2 className="text-xl font-semibold text-[--fg] mb-4">Thông tin cá nhân</h2>

          <form onSubmit={handleSubmitUserInfo} className="space-y-4">
            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                Họ và tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-[--accent] text-[--fg]"
                placeholder="Nhập họ và tên"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-[--accent] text-[--fg]"
                placeholder="Nhập số điện thoại"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                Số tài khoản chứng khoán
              </label>
              <input
                type="text"
                value={stockAccountNumber}
                onChange={(e) => setStockAccountNumber(e.target.value)}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-[--accent] text-[--fg]"
                placeholder="Nhập số tài khoản chứng khoán"
                disabled={saving}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[--accent] hover:bg-[--accent]/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>

            {message && (
              <div
                className={`p-3 rounded-lg text-center text-sm ${
                  message.includes('thành công')
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {message}
              </div>
            )}
          </form>
        </div>

        {/* Section 2: Gói đăng ký */}
        <div className="bg-[--panel] rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-[--fg] mb-4">Gói đăng ký</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[--bg] rounded-lg">
              <div>
                <p className="text-[--fg] font-medium">Gói hiện tại</p>
                <p className="text-[--muted] text-sm mt-1">
                  {profile?.membership === 'premium' ? (
                    <>
                      Bạn đang sử dụng gói Premium
                      {profile?.membership_expires_at && (
                        <> - Hết hạn: {new Date(profile.membership_expires_at).toLocaleDateString('vi-VN')}</>
                      )}
                    </>
                  ) : (
                    'Bạn đang sử dụng gói Free'
                  )}
                </p>
              </div>
              <div>
                {getMembershipBadge()}
              </div>
            </div>

            {profile?.membership === 'free' && (
              <div className="p-4 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-600/50 rounded-lg">
                <h3 className="text-[--fg] font-semibold mb-2">Nâng cấp lên Premium</h3>
                <p className="text-[--muted] text-sm mb-3">
                  Truy cập không giới hạn tín hiệu AI, phân tích chuyên sâu và nhiều tính năng độc quyền khác.
                </p>
                <button
                  onClick={() => router.push('/upgrade')}
                  className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  Nâng cấp ngay →
                </button>
              </div>
            )}

            {profile?.membership === 'premium' && (
              <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                <h3 className="text-green-400 font-semibold mb-2">✓ Bạn đang sử dụng Premium</h3>
                <ul className="text-[--muted] text-sm space-y-1">
                  <li>• Truy cập tín hiệu AI không giới hạn</li>
                  <li>• Phân tích chuyên sâu</li>
                  <li>• Hỗ trợ ưu tiên</li>
                  <li>• Tích hợp TCBS API</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Tích hợp TCBS */}
        <div className="bg-[--panel] rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[--fg]">Tích hợp TCBS</h2>
              <p className="text-[--muted] text-sm mt-1">
                Kết nối với công ty chứng khoán TCBS để tự động đồng bộ tài sản
              </p>
            </div>
            {profile?.tcbs_api_key && (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                ✓ Đã kết nối
              </span>
            )}
          </div>

          {/* Status */}
          {profile?.tcbs_connected_at && (
            <div className="mb-4 p-3 bg-[--bg] rounded-lg">
              <p className="text-[--muted] text-sm">
                Kết nối lần cuối: {new Date(profile.tcbs_connected_at).toLocaleString('vi-VN')}
              </p>
            </div>
          )}

          {/* Coming Soon Badge */}
          <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
            <p className="text-blue-400 text-sm font-medium">
              🚀 Tính năng đang phát triển - Sắp ra mắt
            </p>
          </div>

          <form onSubmit={handleSubmitTCBS} className="space-y-4">
            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                TCBS API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={tcbsApiKey}
                  onChange={(e) => setTCBSApiKey(e.target.value)}
                  className="w-full p-3 pr-12 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-[--accent] text-[--fg] font-mono text-sm"
                  placeholder="Nhập TCBS API Key của bạn"
                  disabled={savingTCBS}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[--muted] hover:text-[--fg]"
                >
                  {showApiKey ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-[--muted] text-xs mt-1">
                API Key sẽ được mã hóa trước khi lưu trữ
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={savingTCBS || !tcbsApiKey.trim()}
                className="flex-1 bg-[--accent] hover:bg-[--accent]/90 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingTCBS ? 'Đang lưu...' : profile?.tcbs_api_key ? 'Cập nhật API Key' : 'Lưu API Key'}
              </button>

              {profile?.tcbs_api_key && (
                <button
                  type="button"
                  onClick={handleRemoveTCBS}
                  disabled={savingTCBS}
                  className="px-6 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Xóa kết nối
                </button>
              )}
            </div>

            {tcbsMessage && (
              <div
                className={`p-3 rounded-lg text-center text-sm ${
                  tcbsMessage.includes('thành công')
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {tcbsMessage}
              </div>
            )}
          </form>

          {/* Help text */}
          <div className="mt-6 p-4 bg-[--bg] rounded-lg">
            <h4 className="text-[--fg] font-medium mb-2">Cách lấy TCBS API Key</h4>
            <ol className="text-[--muted] text-sm space-y-1 list-decimal list-inside">
              <li>Đăng nhập vào tài khoản TCBS của bạn</li>
              <li>Vào phần "Cài đặt" → "API Integration"</li>
              <li>Tạo API Key mới hoặc sao chép key hiện có</li>
              <li>Dán key vào ô trên và nhấn "Lưu API Key"</li>
            </ol>
            <p className="text-[--muted] text-xs mt-3">
              ⚠️ Lưu ý: Không chia sẻ API Key với bất kỳ ai. Key sẽ được mã hóa an toàn trên hệ thống.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  )
}
