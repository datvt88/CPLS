'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'
import {
  SignalStatsWidget,
  TopSignalsWidget,
  SignalScreenerWidget,
  SignalsListWidget,
} from '@/components/signals'
import GoldenCrossSignalsWidget from '@/components/GoldenCrossSignalsWidget'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import BarChartIcon from '@mui/icons-material/BarChart'
import FilterListIcon from '@mui/icons-material/FilterList'
import ListAltIcon from '@mui/icons-material/ListAlt'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

type TabType = 'overview' | 'screener' | 'all' | 'golden'

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Tổng quan', icon: <BarChartIcon sx={{ fontSize: 18 }} /> },
  { id: 'screener', label: 'Bộ lọc', icon: <FilterListIcon sx={{ fontSize: 18 }} /> },
  { id: 'all', label: 'Tất cả', icon: <ListAltIcon sx={{ fontSize: 18 }} /> },
  { id: 'golden', label: 'Golden Cross', icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} /> },
]

export default function SignalsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

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
      setAuthLoading(false)
    }
  }

  const isPremium = profile?.membership === 'premium'

  return (
    <div className="min-h-screen bg-[--bg] pb-10 sm:py-6">
      <div className="w-full max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="pt-4 pb-2 px-3 sm:px-6 sm:mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-[--fg] mb-1 flex items-center gap-2">
              <ShowChartIcon sx={{ fontSize: { xs: 24, sm: 32 } }} className="text-blue-400" />
              Tín hiệu giao dịch
            </h1>
            <p className="text-xs sm:text-sm text-[--muted]">
              Phân tích kỹ thuật và tín hiệu mua/bán tự động
            </p>
          </div>

          <div className="flex items-center gap-2">
            {authLoading ? (
              <div className="px-3 py-1.5 bg-gray-700/50 rounded-lg w-24 h-8 animate-pulse" />
            ) : (
              <>
                {isPremium && (
                  <span className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-xs font-semibold shadow-sm">
                    Premium
                  </span>
                )}
                {!isLoggedIn && (
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    Đăng nhập
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="px-3 sm:px-6 mb-4">
          <div className="bg-[--panel] rounded-lg sm:rounded-xl p-2 sm:p-3 border border-gray-800">
            <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
              <div className="flex gap-2 min-w-max">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold transition-all whitespace-nowrap text-xs sm:text-sm
                      ${activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'}
                    `}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="w-full sm:px-6 space-y-4 sm:space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* Stats Widget */}
              <div className="px-3 sm:px-0">
                <SignalStatsWidget />
              </div>

              {/* Top Signals Widget */}
              <TopSignalsWidget />
            </>
          )}

          {activeTab === 'screener' && <SignalScreenerWidget />}

          {activeTab === 'all' && <SignalsListWidget />}

          {activeTab === 'golden' && <GoldenCrossSignalsWidget />}
        </div>

        {/* Call-to-action Banners */}
        {!authLoading && !isLoggedIn ? (
          <div className="mt-6 px-3 sm:px-6">
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-600/30 rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="hidden sm:flex w-12 h-12 bg-blue-600/20 rounded-lg items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="flex-1 w-full">
                  <h3 className="text-[--fg] font-semibold mb-2 text-base sm:text-lg">
                    Đăng nhập để trải nghiệm đầy đủ
                  </h3>
                  <p className="text-[--muted] text-sm mb-4 leading-relaxed">
                    Tạo tài khoản miễn phí để lưu danh sách theo dõi, nhận thông báo và truy cập
                    nhiều tính năng khác.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => router.push('/auth/login')}
                      className="flex-1 sm:flex-none justify-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-md text-sm inline-flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                        />
                      </svg>
                      Đăng nhập ngay
                    </button>
                    <button
                      onClick={() => router.push('/register')}
                      className="flex-1 sm:flex-none justify-center bg-gray-700/80 hover:bg-gray-600 text-white font-semibold px-6 py-2.5 rounded-lg transition-all text-sm border border-gray-600"
                    >
                      Đăng ký miễn phí
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !authLoading && !isPremium ? (
          <div className="mt-6 px-3 sm:px-6">
            <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/30 rounded-xl p-4 sm:p-6 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="hidden sm:flex w-12 h-12 bg-purple-600/20 rounded-lg items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="flex-1 w-full">
                  <h3 className="text-[--fg] font-semibold mb-2 text-base sm:text-lg">
                    Nâng cấp Premium
                  </h3>
                  <p className="text-[--muted] text-sm mb-4 leading-relaxed">
                    Mở khóa toàn bộ các tính năng nâng cao và tín hiệu độc quyền.
                  </p>
                  <button
                    onClick={() => router.push('/upgrade')}
                    className="w-full sm:w-auto justify-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-lg hover:shadow-purple-600/50 text-sm inline-flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Liên hệ admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
