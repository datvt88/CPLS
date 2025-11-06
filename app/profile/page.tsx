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
  const [message, setMessage] = useState('')

  // Form fields
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [stockAccountNumber, setStockAccountNumber] = useState('')

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
        setMessage('Không thể tải thông tin hồ sơ')
      } else if (userProfile) {
        setProfile(userProfile)
        setFullName(userProfile.full_name || '')
        setPhoneNumber(userProfile.phone_number || '')
        setStockAccountNumber(userProfile.stock_account_number || '')
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
      <div className="max-w-2xl mx-auto">
        <div className="bg-[--panel] rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-[--fg]">Hồ sơ của tôi</h1>
            {getMembershipBadge()}
          </div>

          {/* Avatar and Email */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[--border]">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-20 h-20 rounded-full"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[--accent] flex items-center justify-center text-white text-2xl font-bold">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <p className="text-[--fg] font-semibold">{profile?.email}</p>
              <p className="text-[--muted] text-sm">
                Tham gia: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : 'N/A'}
              </p>
              {profile?.zalo_id && (
                <p className="text-[--muted] text-sm flex items-center gap-1">
                  <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" rx="24" fill="currentColor"/>
                  </svg>
                  Đã liên kết với Zalo
                </p>
              )}
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
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
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-center ${
                message.includes('thành công')
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {message}
            </div>
          )}

          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t border-[--border]">
            <h3 className="text-[--fg] font-semibold mb-3">Thông tin gói dịch vụ</h3>
            <div className="space-y-2 text-sm">
              <p className="text-[--muted]">
                <span className="font-medium">Gói hiện tại:</span>{' '}
                {profile?.membership === 'premium' ? 'Premium' : 'Free'}
              </p>
              {profile?.membership === 'free' && (
                <button
                  onClick={() => router.push('/upgrade')}
                  className="text-[--accent] hover:underline font-medium"
                >
                  Nâng cấp lên Premium →
                </button>
              )}
            </div>
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
