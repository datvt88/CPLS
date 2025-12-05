'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'
import ProtectedRoute from '@/components/ProtectedRoute'
import DeviceManagement from '@/components/DeviceManagement'
import PasswordManagement from '@/components/PasswordManagement'

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
  const [nickname, setNickname] = useState('')
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
        setNickname(userProfile.nickname || '')
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
        nickname: nickname.trim() || undefined,
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
      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
      : 'bg-green-500/30 text-green-400 border border-green-500/50'

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
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Đang tải thông tin...</p>
        </div>
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
        <div className="bg-[--panel] rounded-lg shadow-lg p-6 border border-gray-800">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[--border]">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-purple-500"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-2xl font-bold">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="text-[--fg] font-semibold text-lg">{profile?.email}</p>
              <p className="text-[--muted] text-sm">
                Tham gia: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'N/A'}
              </p>
              {profile?.provider && (
                <p className="text-[--muted] text-sm flex items-center gap-1 mt-1">
                  {profile.provider === 'google' && (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Đăng nhập bằng Google
                    </>
                  )}
                  {profile.provider === 'zalo' && profile.zalo_id && (
                    <>
                      <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                        <circle cx="24" cy="24" r="24" fill="#0068FF"/>
                      </svg>
                      Đăng nhập bằng Zalo
                    </>
                  )}
                </p>
              )}
            </div>
          </div>

          <h2 className="text-xl font-semibold text-[--fg] mb-4">Thông tin cá nhân</h2>

          <form onSubmit={handleSubmitUserInfo} className="space-y-4">
            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg] transition-all"
                placeholder="Nhập họ và tên đầy đủ"
                disabled={saving}
                required
              />
            </div>

            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                Tên hiển thị (Nickname)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg] transition-all"
                placeholder="Tên hiển thị trên hệ thống"
                disabled={saving}
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">Từ 2-50 ký tự</p>
            </div>

            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg] transition-all"
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
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg] transition-all"
                placeholder="Nhập số tài khoản chứng khoán"
                disabled={saving}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-lg transition-all shadow-lg hover:shadow-green-600/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center justify-center gap-2"
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
                  Lưu thông tin
                </>
              )}
            </button>

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
              <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
                <h3 className="text-green-400 font-semibold mb-2">Nâng cấp lên Premium</h3>
                <p className="text-[--muted] text-sm mb-3">
                  Truy cập không giới hạn tín hiệu AI, phân tích chuyên sâu và nhiều tính năng độc quyền khác.
                </p>
                <button
                  onClick={() => router.push('/upgrade')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                >
                  Nâng cấp ngay →
                </button>
              </div>
            )}

            {profile?.membership === 'premium' && (
              <div className="p-4 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 rounded-lg">
                <h3 className="text-purple-300 font-semibold mb-2">✓ Bạn đang sử dụng Premium</h3>
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

        {/* Section 2.5: Quản lý mật khẩu */}
        <PasswordManagement />

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

        {/* Section 4: Quản lý thiết bị */}
        <DeviceManagement />
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
