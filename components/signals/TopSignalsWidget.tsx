'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { getTopSignals } from '@/services/signalApi.service'
import type { Signal, TopSignalsResponse } from '@/types/signal'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import StarIcon from '@mui/icons-material/Star'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'

// Format number as Vietnamese format
const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

// Format percentage
const formatPercent = (num: number | undefined): string => {
  if (num === undefined || num === null) return '-'
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
}

// Signal strength badge
const StrengthBadge = memo(({ strength }: { strength: string }) => {
  const colors: Record<string, string> = {
    strong: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    weak: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  const labels: Record<string, string> = {
    strong: 'Mạnh',
    medium: 'TB',
    weak: 'Yếu',
  }

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${colors[strength] || colors.weak}`}>
      {labels[strength] || strength}
    </span>
  )
})
StrengthBadge.displayName = 'StrengthBadge'

// Signal Card Component
const SignalCard = memo(({
  signal,
  type,
  onClick,
}: {
  signal: Signal
  type: 'buy' | 'sell'
  onClick: () => void
}) => (
  <div
    onClick={onClick}
    className={`
      p-3 sm:p-4 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]
      ${type === 'buy'
        ? 'bg-green-900/10 border-green-600/30 hover:bg-green-900/20'
        : 'bg-red-900/10 border-red-600/30 hover:bg-red-900/20'}
    `}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-white font-bold text-base sm:text-lg">{signal.stock_code}</span>
        <StrengthBadge strength={signal.signal_strength} />
      </div>
      <span className={`text-xs font-medium ${type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
        {type === 'buy' ? 'MUA' : 'BÁN'}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-2 text-sm">
      <div>
        <span className="text-gray-500 text-xs">Giá vào</span>
        <div className="text-white font-medium">{formatNumber(signal.entry_price)}</div>
      </div>
      <div>
        <span className="text-gray-500 text-xs">Mục tiêu</span>
        <div className={`font-medium ${type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
          {formatNumber(signal.target_price)}
        </div>
      </div>
      <div>
        <span className="text-gray-500 text-xs">Tiềm năng</span>
        <div className={`font-semibold ${signal.potential_gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatPercent(signal.potential_gain)}
        </div>
      </div>
      <div>
        <span className="text-gray-500 text-xs">Độ tin cậy</span>
        <div className="text-purple-400 font-medium">
          {(signal.confidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>

    <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-center">
      <span className="text-xs text-gray-500">{signal.strategy}</span>
      <span className="text-xs text-gray-400">R:R {signal.risk_reward_ratio.toFixed(1)}</span>
    </div>
  </div>
))
SignalCard.displayName = 'SignalCard'

// Skeleton Loader
const SkeletonLoader = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-gray-800/50 rounded-xl h-48" />
    ))}
  </div>
)

// Tab type
type TabType = 'buy' | 'sell' | 'confident' | 'potential'

function TopSignalsWidget() {
  const router = useRouter()
  const [data, setData] = useState<TopSignalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('buy')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await getTopSignals()
      setData(result)
    } catch (err: any) {
      console.error('Error fetching top signals:', err)
      setError('Không thể tải tín hiệu hàng đầu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSignalClick = (stockCode: string) => {
    router.push(`/stocks?symbol=${stockCode}`)
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'buy', label: 'Top MUA', icon: <TrendingUpIcon sx={{ fontSize: 18 }} />, color: 'green' },
    { id: 'sell', label: 'Top BÁN', icon: <TrendingDownIcon sx={{ fontSize: 18 }} />, color: 'red' },
    { id: 'confident', label: 'Tin cậy nhất', icon: <StarIcon sx={{ fontSize: 18 }} />, color: 'purple' },
    { id: 'potential', label: 'Tiềm năng nhất', icon: <RocketLaunchIcon sx={{ fontSize: 18 }} />, color: 'yellow' },
  ]

  const getSignalsForTab = (): Signal[] => {
    if (!data) return []
    switch (activeTab) {
      case 'buy':
        return data.top_buy || []
      case 'sell':
        return data.top_sell || []
      case 'confident':
        return data.most_confident || []
      case 'potential':
        return data.highest_potential || []
      default:
        return []
    }
  }

  const signals = getSignalsForTab()

  if (loading) return <SkeletonLoader />

  if (error) {
    return (
      <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4 text-center">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={fetchData}
          className="mt-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
        >
          Thử lại
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-4 sm:p-6 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <StarIcon className="text-yellow-400" sx={{ fontSize: 24 }} />
          Tín hiệu hàng đầu
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap
              ${activeTab === tab.id
                ? `bg-${tab.color}-600/20 text-${tab.color}-400 border border-${tab.color}-500/30`
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-transparent'}
            `}
            style={{
              backgroundColor: activeTab === tab.id
                ? tab.color === 'green' ? 'rgba(34, 197, 94, 0.2)'
                  : tab.color === 'red' ? 'rgba(239, 68, 68, 0.2)'
                  : tab.color === 'purple' ? 'rgba(168, 85, 247, 0.2)'
                  : 'rgba(234, 179, 8, 0.2)'
                : undefined,
              color: activeTab === tab.id
                ? tab.color === 'green' ? 'rgb(74, 222, 128)'
                  : tab.color === 'red' ? 'rgb(248, 113, 113)'
                  : tab.color === 'purple' ? 'rgb(192, 132, 252)'
                  : 'rgb(250, 204, 21)'
                : undefined,
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Signals Grid */}
      {signals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {signals.slice(0, 8).map((signal) => (
            <SignalCard
              key={`${signal.stock_code}-${signal.id}`}
              signal={signal}
              type={signal.signal_type === 'BUY' ? 'buy' : 'sell'}
              onClick={() => handleSignalClick(signal.stock_code)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/30 rounded-lg p-6 text-center">
          <p className="text-gray-400 text-sm">Chưa có tín hiệu nào</p>
        </div>
      )}
    </div>
  )
}

export default memo(TopSignalsWidget)
