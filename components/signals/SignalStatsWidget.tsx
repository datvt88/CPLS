'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { getSignalStats } from '@/services/signalApi.service'
import type { SignalStats } from '@/types/signal'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import BarChartIcon from '@mui/icons-material/BarChart'

// Skeleton Loader
const SkeletonLoader = () => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-gray-800/50 rounded-xl p-4 h-24" />
    ))}
  </div>
)

// Stat Card Component
const StatCard = memo(({
  icon,
  label,
  value,
  subValue,
  color = 'blue',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  subValue?: string
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple'
}) => {
  const colorClasses = {
    blue: 'from-blue-600/20 to-blue-800/10 border-blue-600/30 text-blue-400',
    green: 'from-green-600/20 to-green-800/10 border-green-600/30 text-green-400',
    red: 'from-red-600/20 to-red-800/10 border-red-600/30 text-red-400',
    yellow: 'from-yellow-600/20 to-yellow-800/10 border-yellow-600/30 text-yellow-400',
    purple: 'from-purple-600/20 to-purple-800/10 border-purple-600/30 text-purple-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-3 sm:p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={colorClasses[color].split(' ').pop()}>{icon}</span>
        <span className="text-xs sm:text-sm text-gray-400 font-medium">{label}</span>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-white">{value}</div>
      {subValue && <div className="text-xs text-gray-500 mt-1">{subValue}</div>}
    </div>
  )
})
StatCard.displayName = 'StatCard'

function SignalStatsWidget() {
  const [stats, setStats] = useState<SignalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getSignalStats()
      setStats(data)
    } catch (err: any) {
      console.error('Error fetching signal stats:', err)
      setError('Không thể tải thống kê tín hiệu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (loading) return <SkeletonLoader />

  if (error) {
    return (
      <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
        >
          Thử lại
        </button>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 text-center">
        <p className="text-gray-400 text-sm">Chưa có dữ liệu thống kê</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<ShowChartIcon sx={{ fontSize: 20 }} />}
          label="Tổng tín hiệu"
          value={stats.total_signals.toLocaleString()}
          subValue={`${stats.strong_signals} tín hiệu mạnh`}
          color="blue"
        />
        <StatCard
          icon={<TrendingUpIcon sx={{ fontSize: 20 }} />}
          label="Tín hiệu MUA"
          value={stats.buy_signals.toLocaleString()}
          subValue={`${((stats.buy_signals / stats.total_signals) * 100).toFixed(0)}% tổng số`}
          color="green"
        />
        <StatCard
          icon={<TrendingDownIcon sx={{ fontSize: 20 }} />}
          label="Tín hiệu BÁN"
          value={stats.sell_signals.toLocaleString()}
          subValue={`${((stats.sell_signals / stats.total_signals) * 100).toFixed(0)}% tổng số`}
          color="red"
        />
        <StatCard
          icon={<BarChartIcon sx={{ fontSize: 20 }} />}
          label="Độ tin cậy TB"
          value={`${(stats.avg_confidence * 100).toFixed(0)}%`}
          subValue={`Tiềm năng: +${stats.avg_potential_gain.toFixed(1)}%`}
          color="purple"
        />
      </div>

      {/* Signal Strength Distribution */}
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <h4 className="text-sm font-semibold text-gray-400 mb-3">Phân bố độ mạnh tín hiệu</h4>
        <div className="flex gap-2 sm:gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-green-400">Mạnh</span>
              <span className="text-gray-400">{stats.strong_signals}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                style={{ width: `${(stats.strong_signals / stats.total_signals) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-yellow-400">Trung bình</span>
              <span className="text-gray-400">{stats.medium_signals}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full"
                style={{ width: `${(stats.medium_signals / stats.total_signals) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Yếu</span>
              <span className="text-gray-400">{stats.weak_signals}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gray-500 to-gray-400 rounded-full"
                style={{ width: `${(stats.weak_signals / stats.total_signals) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Strategies */}
      {stats.top_strategies && stats.top_strategies.length > 0 && (
        <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Chiến lược hàng đầu</h4>
          <div className="space-y-2">
            {stats.top_strategies.slice(0, 3).map((strategy, index) => (
              <div
                key={strategy.strategy}
                className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-purple-600/20 text-purple-400 rounded-full text-xs font-bold">
                    {index + 1}
                  </span>
                  <span className="text-white font-medium text-sm">{strategy.strategy}</span>
                </div>
                <div className="text-right">
                  <span className="text-green-400 text-sm font-semibold">
                    +{strategy.avg_potential_gain.toFixed(1)}%
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    ({strategy.signal_count} tín hiệu)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(SignalStatsWidget)
