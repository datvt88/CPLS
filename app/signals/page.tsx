'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'
import GoldenCrossSignalsWidget from '@/components/GoldenCrossSignalsWidget'

export default function SignalsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthAndLoadProfile()
  }, [])

  const checkAuthAndLoadProfile = async () => {
    try {
      const { user } = await authService.getUser()

      if (user) {
        setIsLoggedIn(true)
        const { profile: userProfile, error } = await profileService.getProfile(user.id)
        if (!error && userProfile) {
          setProfile(userProfile)
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error)
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

  // Show signals for all users (logged in, free, premium, anonymous)
  return (
    <div className="min-h-screen bg-[--bg] px-2 py-4 sm:px-4 sm:py-6">
      <div className="w-full mx-auto">
        {/* Header with membership badge */}
        <div className="mb-4 sm:mb-8 flex items-center justify-between flex-wrap gap-2 sm:gap-4 px-2 sm:px-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[--fg] mb-1 sm:mb-2">Tín hiệu</h1>
            <p className="text-xs sm:text-sm text-[--muted]">Danh sách mã cổ phiếu từ Firebase Realtime Database</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isPremium && (
              <span className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-xs sm:text-sm font-semibold">
                ⭐ Premium
              </span>
            )}
            {!isLoggedIn && (
              <button
                onClick={() => router.push('/login')}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>

        {/* Signals Content - Public access */}
        <GoldenCrossSignalsWidget />

        {/* Call-to-action banners */}
        {!isLoggedIn ? (
          // Banner for anonymous users
          <div className="mt-4 sm:mt-8 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-600/30 rounded-lg sm:rounded-xl p-4 sm:p-6 mx-2 sm:mx-0">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[--fg] font-semibold mb-2">Đăng nhập để trải nghiệm đầy đủ</h3>
                <p className="text-[--muted] text-sm mb-4">
                  Tạo tài khoản miễn phí để lưu danh sách theo dõi, nhận thông báo và truy cập nhiều tính năng khác.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push('/login')}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-lg transition-all shadow-lg hover:shadow-blue-600/50 text-sm inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => router.push('/register')}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-2 rounded-lg transition-all text-sm"
                  >
                    Đăng ký miễn phí
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : !isPremium ? (
          // Banner for free logged-in users
          <div className="mt-4 sm:mt-8 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/30 rounded-lg sm:rounded-xl p-4 sm:p-6 mx-2 sm:mx-0">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-[--fg] font-semibold mb-2">Nâng cấp lên Premium để mở khóa thêm tính năng</h3>
                <p className="text-[--muted] text-sm mb-4">
                  Tín hiệu AI nâng cao, cảnh báo thời gian thực, bộ lọc cổ phiếu tiềm năng và hỗ trợ trực tiếp từ đội ngũ admin.
                </p>
                <button
                  onClick={() => router.push('/upgrade')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-6 py-2 rounded-lg transition-all shadow-lg hover:shadow-purple-600/50 text-sm inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Tìm hiểu thêm về Premium
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
