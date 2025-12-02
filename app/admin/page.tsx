'use client'

import AdminRoute from '@/components/AdminRoute'
import AnalyticsWidget from '@/components/admin/AnalyticsWidget'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

interface DashboardStats {
  totalUsers: number
  premiumUsers: number
  freeUsers: number
  activeToday: number
  totalSignals: number
  recentSignals: Array<{
    ticker: string
    signal: string
    confidence: number
    created_at: string
  }>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    premiumUsers: 0,
    freeUsers: 0,
    activeToday: 0,
    totalSignals: 0,
    recentSignals: [],
  })
  const [loading, setLoading] = useState(true)
  const [adminEmail, setAdminEmail] = useState<string>('')

  useEffect(() => {
    loadDashboardStats()
  }, [])

  const loadDashboardStats = async () => {
    try {
      // Get current admin info
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setAdminEmail(user.email || '')
      }

      // Get total users count
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      // Get premium users count
      const { count: premiumUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('membership', 'premium')

      // Get free users count
      const { count: freeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('membership', 'free')

      // Get users active today (created or updated today)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: activeToday } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', today.toISOString())

      // Get total signals
      const { count: totalSignals } = await supabase
        .from('signals')
        .select('*', { count: 'exact', head: true })

      // Get recent signals
      const { data: recentSignals } = await supabase
        .from('signals')
        .select('ticker, signal, confidence, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      setStats({
        totalUsers: totalUsers || 0,
        premiumUsers: premiumUsers || 0,
        freeUsers: freeUsers || 0,
        activeToday: activeToday || 0,
        totalSignals: totalSignals || 0,
        recentSignals: recentSignals || [],
      })
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminRoute>
      <div className="min-h-screen bg-[--bg] p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              🎛️ Admin Dashboard
            </h1>
            <p className="text-gray-400">
              Chào mừng <span className="text-purple-400">{adminEmail}</span> - Quản trị viên hệ thống
            </p>
          </div>

          {/* Stats Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Users */}
                <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Tổng người dùng</span>
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
                </div>

                {/* Premium Users */}
                <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 border border-yellow-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Premium</span>
                    <span className="text-2xl">⭐</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.premiumUsers}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {stats.totalUsers > 0
                      ? `${((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1)}% conversion`
                      : '0% conversion'
                    }
                  </div>
                </div>

                {/* Free Users */}
                <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Free</span>
                    <span className="text-2xl">🆓</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.freeUsers}</div>
                </div>

                {/* Active Today */}
                <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-500/30 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Hoạt động hôm nay</span>
                    <span className="text-2xl">🔥</span>
                  </div>
                  <div className="text-3xl font-bold text-white">{stats.activeToday}</div>
                </div>
              </div>

              {/* Analytics Widget */}
              <div className="mb-8">
                <AnalyticsWidget />
              </div>

              {/* Recent Signals */}
              <div className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    📊 Tín hiệu gần đây
                  </h2>
                  <span className="text-gray-400 text-sm">
                    Tổng: {stats.totalSignals} tín hiệu
                  </span>
                </div>

                {stats.recentSignals.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Chưa có tín hiệu nào</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-700 text-left">
                          <th className="pb-3 px-4 text-gray-400 font-medium">Mã CK</th>
                          <th className="pb-3 px-4 text-gray-400 font-medium">Tín hiệu</th>
                          <th className="pb-3 px-4 text-gray-400 font-medium">Độ tin cậy</th>
                          <th className="pb-3 px-4 text-gray-400 font-medium">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.recentSignals.map((signal, index) => (
                          <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50">
                            <td className="py-3 px-4 font-mono font-bold text-white">
                              {signal.ticker}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                signal.signal === 'BUY'
                                  ? 'bg-green-500/20 text-green-400'
                                  : signal.signal === 'SELL'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-gray-500/20 text-gray-400'
                              }`}>
                                {signal.signal}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-white">
                              {signal.confidence ? `${(signal.confidence * 100).toFixed(0)}%` : 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-gray-400 text-sm">
                              {new Date(signal.created_at).toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminRoute>
  )
}
