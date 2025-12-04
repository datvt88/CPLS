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

  // Show signals for all users (free + premium)
  return (
    <div className="min-h-screen bg-[--bg] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with membership badge */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[--fg] mb-2">Tín hiệu</h1>
            <p className="text-[--muted]">Danh sách mã cổ phiếu từ Firebase Realtime Database</p>
          </div>
          {isPremium && (
            <span className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold">
              ⭐ Premium
            </span>
          )}
        </div>

        {/* Signals Content - Available for all users */}
        <GoldenCrossSignalsWidget />

        {/* Info banner for free users */}
        {!isPremium && (
          <div className="mt-8 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/30 rounded-xl p-6">
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
        )}
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
