'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'
import GoldenCrossSignalsWidget from '@/components/GoldenCrossSignalsWidget'

function SignalsPageContent() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

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
      } else if (userProfile) {
        setProfile(userProfile)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Đang tải...</p>
        </div>
      </div>
    )
  }

  const isPremium = profile?.membership === 'premium'

  // Free users see upgrade message
  if (!isPremium) {
    return (
      <div className="min-h-screen bg-[--bg] p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[--fg] mb-2">Tín hiệu AI</h1>
            <p className="text-[--muted]">Tính năng dành riêng cho nhà đầu tư cùng đồng hành (Invest Partner)</p>
          </div>

          {/* Premium Required Message */}
          <div className="bg-[--panel] rounded-xl shadow-lg p-8 border border-gray-800">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[--fg] mb-3">Tính năng dành cho nhà đầu tư Premium</h2>
              <p className="text-[--muted] text-lg mb-8">
                Vui lòng liên hệ Admin để nâng cấp lên Premium và trở thành nhà đầu tư cùng đồng hành
              </p>
            </div>

            {/* Premium Benefits */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-[--bg] p-6 rounded-lg border border-gray-800">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[--fg] font-semibold mb-1">Tín hiệu AI không giới hạn</h3>
                    <p className="text-[--muted] text-sm">Nhận tín hiệu mua/bán từ AI được huấn luyện trên dữ liệu thị trường</p>
                  </div>
                </div>
              </div>

              <div className="bg-[--bg] p-6 rounded-lg border border-gray-800">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[--fg] font-semibold mb-1">Bộ lọc cổ phiếu tiềm năng lướt sóng</h3>
                    <p className="text-[--muted] text-sm">Tìm kiếm và lọc các cổ phiếu có tiềm năng cho chiến lược lướt sóng</p>
                  </div>
                </div>
              </div>

              <div className="bg-[--bg] p-6 rounded-lg border border-gray-800">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[--fg] font-semibold mb-1">Cảnh báo thời gian thực</h3>
                    <p className="text-[--muted] text-sm">Nhận thông báo ngay khi có tín hiệu quan trọng</p>
                  </div>
                </div>
              </div>

              <div className="bg-[--bg] p-6 rounded-lg border border-gray-800">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[--fg] font-semibold mb-1">Hỗ trợ đồng hành từ đội ngũ admin</h3>
                    <p className="text-[--muted] text-sm">Được tư vấn và hỗ trợ trực tiếp từ đội ngũ quản trị viên</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upgrade Button */}
            <div className="text-center">
              <button
                onClick={() => router.push('/upgrade')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-purple-600/50 text-lg inline-flex items-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Liên hệ Admin để nâng cấp
              </button>
              <p className="text-[--muted] text-sm mt-4">
                Trở thành nhà đầu tư cùng đồng hành với gói Premium
              </p>
            </div>
          </div>

          {/* Free Features Teaser */}
          <div className="mt-8 bg-[--panel] rounded-xl p-6 border border-gray-800">
            <h3 className="text-[--fg] font-semibold mb-4">Bạn đang sử dụng gói Free</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[--muted] text-sm">Xem giá cổ phiếu</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[--muted] text-sm">Theo dõi thị trường</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[--muted] text-sm">Biểu đồ cơ bản</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Premium users see actual content
  return (
    <div className="min-h-screen bg-[--bg] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Premium Badge */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[--fg] mb-2">Tín hiệu</h1>
            <p className="text-[--muted]">Danh sách mã cổ phiếu từ Firebase Realtime Database</p>
          </div>
          <span className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold">
            ⭐ Premium
          </span>
        </div>

        {/* Premium Content - Simple Stock List */}
        <GoldenCrossSignalsWidget />
      </div>
    </div>
  )
}

export default function SignalsPage() {
  return (
    <ProtectedRoute>
      <SignalsPageContent />
    </ProtectedRoute>
  )
}
