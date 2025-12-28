'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import {
  getBuyScreener,
  getSellScreener,
  getMomentumScreener,
  getOversoldScreener,
  getBreakoutScreener,
} from '@/services/signalApi.service'
import type { ScreenerResult } from '@/types/signal'
import FilterListIcon from '@mui/icons-material/FilterList'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import SpeedIcon from '@mui/icons-material/Speed'
import AutoGraphIcon from '@mui/icons-material/AutoGraph'
import ShowChartIcon from '@mui/icons-material/ShowChart'

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

// Screener types
type ScreenerType = 'buy' | 'sell' | 'momentum' | 'oversold' | 'breakout'

const screenerConfig: { id: ScreenerType; label: string; icon: React.ReactNode; color: string; description: string }[] = [
  {
    id: 'buy',
    label: 'Mua',
    icon: <TrendingUpIcon sx={{ fontSize: 18 }} />,
    color: 'green',
    description: 'Cổ phiếu có tín hiệu mua mạnh',
  },
  {
    id: 'sell',
    label: 'Bán',
    icon: <TrendingDownIcon sx={{ fontSize: 18 }} />,
    color: 'red',
    description: 'Cổ phiếu cần cân nhắc chốt lời',
  },
  {
    id: 'momentum',
    label: 'Momentum',
    icon: <SpeedIcon sx={{ fontSize: 18 }} />,
    color: 'purple',
    description: 'Cổ phiếu đang có đà tăng mạnh',
  },
  {
    id: 'oversold',
    label: 'Quá bán',
    icon: <AutoGraphIcon sx={{ fontSize: 18 }} />,
    color: 'yellow',
    description: 'Cổ phiếu bị bán quá mức (RSI thấp)',
  },
  {
    id: 'breakout',
    label: 'Breakout',
    icon: <ShowChartIcon sx={{ fontSize: 18 }} />,
    color: 'blue',
    description: 'Cổ phiếu đang phá vỡ kháng cự',
  },
]

// Desktop Row Component
const DesktopRow = memo(({
  result,
  onClick,
}: {
  result: ScreenerResult
  onClick: () => void
}) => (
  <tr
    onClick={onClick}
    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer group"
  >
    <td className="py-3 px-4">
      <span className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
        {result.stock_code}
      </span>
    </td>
    <td className="py-3 px-4 text-right">
      <span className={`font-medium ${result.signal_type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
        {result.signal_type === 'BUY' ? 'MUA' : 'BÁN'}
      </span>
    </td>
    <td className="py-3 px-4 text-right text-white font-medium">
      {formatNumber(result.entry_price)}
    </td>
    <td className="py-3 px-4 text-right text-green-400 font-medium">
      {formatNumber(result.target_price)}
    </td>
    <td className="py-3 px-4 text-right">
      <span className={`font-semibold ${result.potential_gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {formatPercent(result.potential_gain)}
      </span>
    </td>
    <td className="py-3 px-4 text-right text-purple-400">
      {(result.confidence * 100).toFixed(0)}%
    </td>
    <td className="py-3 px-4 text-right text-gray-400 text-sm">
      {result.risk_reward_ratio.toFixed(1)}
    </td>
    <td className="py-3 px-4">
      <span className={`
        text-[10px] px-1.5 py-0.5 rounded border font-medium
        ${result.signal_strength === 'strong' ? 'bg-green-500/20 text-green-400 border-green-500/30'
          : result.signal_strength === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
      `}>
        {result.signal_strength === 'strong' ? 'Mạnh' : result.signal_strength === 'medium' ? 'TB' : 'Yếu'}
      </span>
    </td>
  </tr>
))
DesktopRow.displayName = 'DesktopRow'

// Mobile Card Component
const MobileCard = memo(({
  result,
  onClick,
}: {
  result: ScreenerResult
  onClick: () => void
}) => (
  <div
    onClick={onClick}
    className="border-b border-gray-800 p-3 cursor-pointer bg-[#111] last:border-0 active:bg-gray-800/50"
  >
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
        <span className="font-bold text-white text-lg">{result.stock_code}</span>
        <span className={`
          text-[10px] px-1.5 py-0.5 rounded border font-medium
          ${result.signal_type === 'BUY'
            ? 'bg-green-900/30 text-green-400 border-green-700/30'
            : 'bg-red-900/30 text-red-400 border-red-700/30'}
        `}>
          {result.signal_type === 'BUY' ? 'MUA' : 'BÁN'}
        </span>
      </div>
      <span className={`
        text-[10px] px-1.5 py-0.5 rounded border font-medium
        ${result.signal_strength === 'strong' ? 'bg-green-500/20 text-green-400 border-green-500/30'
          : result.signal_strength === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
      `}>
        {result.signal_strength === 'strong' ? 'Mạnh' : result.signal_strength === 'medium' ? 'TB' : 'Yếu'}
      </span>
    </div>

    <div className="grid grid-cols-3 gap-2 text-sm">
      <div>
        <span className="text-gray-500 text-xs">Giá vào</span>
        <div className="text-white font-medium">{formatNumber(result.entry_price)}</div>
      </div>
      <div>
        <span className="text-gray-500 text-xs">Mục tiêu</span>
        <div className="text-green-400 font-medium">{formatNumber(result.target_price)}</div>
      </div>
      <div>
        <span className="text-gray-500 text-xs">Tiềm năng</span>
        <div className={`font-semibold ${result.potential_gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatPercent(result.potential_gain)}
        </div>
      </div>
    </div>

    <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800">
      <span className="text-xs text-gray-500">{result.strategy}</span>
      <span className="text-xs text-purple-400">Tin cậy: {(result.confidence * 100).toFixed(0)}%</span>
    </div>
  </div>
))
MobileCard.displayName = 'MobileCard'

// Skeleton Loader
const SkeletonLoader = () => (
  <>
    <div className="sm:hidden space-y-0 divide-y divide-gray-800">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 animate-pulse">
          <div className="flex justify-between mb-2">
            <div className="h-6 w-16 bg-gray-800 rounded" />
            <div className="h-5 w-12 bg-gray-800 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-8 bg-gray-800 rounded" />
            <div className="h-8 bg-gray-800 rounded" />
            <div className="h-8 bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </div>
    <table className="hidden sm:table w-full">
      <tbody>
        {Array.from({ length: 5 }).map((_, i) => (
          <tr key={i} className="border-b border-gray-800 animate-pulse">
            <td className="py-4 px-4"><div className="h-5 w-14 bg-gray-800 rounded" /></td>
            <td className="py-4 px-4"><div className="h-5 w-12 bg-gray-800 rounded ml-auto" /></td>
            <td className="py-4 px-4"><div className="h-5 w-16 bg-gray-800 rounded ml-auto" /></td>
            <td className="py-4 px-4"><div className="h-5 w-16 bg-gray-800 rounded ml-auto" /></td>
            <td className="py-4 px-4"><div className="h-5 w-12 bg-gray-800 rounded ml-auto" /></td>
            <td className="py-4 px-4"><div className="h-5 w-10 bg-gray-800 rounded ml-auto" /></td>
            <td className="py-4 px-4"><div className="h-5 w-8 bg-gray-800 rounded ml-auto" /></td>
            <td className="py-4 px-4"><div className="h-5 w-12 bg-gray-800 rounded" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
)

function SignalScreenerWidget() {
  const router = useRouter()
  const [activeScreener, setActiveScreener] = useState<ScreenerType>('buy')
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchScreenerData = useCallback(async (type: ScreenerType) => {
    setLoading(true)
    setError(null)

    try {
      let data: ScreenerResult[] = []
      switch (type) {
        case 'buy':
          data = await getBuyScreener(20)
          break
        case 'sell':
          data = await getSellScreener(20)
          break
        case 'momentum':
          data = await getMomentumScreener(20)
          break
        case 'oversold':
          data = await getOversoldScreener(20)
          break
        case 'breakout':
          data = await getBreakoutScreener(20)
          break
      }
      setResults(data)
    } catch (err: any) {
      console.error('Error fetching screener data:', err)
      setError('Không thể tải dữ liệu screener')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScreenerData(activeScreener)
  }, [activeScreener, fetchScreenerData])

  const handleStockClick = (stockCode: string) => {
    router.push(`/stocks?symbol=${stockCode}`)
  }

  const currentConfig = screenerConfig.find((s) => s.id === activeScreener)

  return (
    <div className="bg-[--panel] sm:rounded-xl sm:p-6 sm:border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-3 sm:px-0">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <FilterListIcon className="text-blue-400" sx={{ fontSize: 24 }} />
            Bộ lọc tín hiệu
          </h3>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            {currentConfig?.description}
          </p>
        </div>
      </div>

      {/* Screener Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 px-3 sm:px-0 -mx-1 sm:mx-0">
        {screenerConfig.map((screener) => {
          const isActive = activeScreener === screener.id
          const colorStyles: Record<string, { bg: string; text: string }> = {
            green: { bg: 'rgba(34, 197, 94, 0.2)', text: 'rgb(74, 222, 128)' },
            red: { bg: 'rgba(239, 68, 68, 0.2)', text: 'rgb(248, 113, 113)' },
            purple: { bg: 'rgba(168, 85, 247, 0.2)', text: 'rgb(192, 132, 252)' },
            yellow: { bg: 'rgba(234, 179, 8, 0.2)', text: 'rgb(250, 204, 21)' },
            blue: { bg: 'rgba(59, 130, 246, 0.2)', text: 'rgb(96, 165, 250)' },
          }

          return (
            <button
              key={screener.id}
              onClick={() => setActiveScreener(screener.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all text-sm whitespace-nowrap border
                ${isActive ? '' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border-transparent'}
              `}
              style={isActive ? {
                backgroundColor: colorStyles[screener.color].bg,
                color: colorStyles[screener.color].text,
                borderColor: `${colorStyles[screener.color].text}40`,
              } : undefined}
            >
              {screener.icon}
              <span>{screener.label}</span>
            </button>
          )
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4 text-center mx-3 sm:mx-0">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => fetchScreenerData(activeScreener)}
            className="mt-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="overflow-hidden rounded-lg sm:border border-gray-800 bg-transparent sm:bg-[#111]">
          <SkeletonLoader />
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {results.length > 0 ? (
            <div className="overflow-hidden rounded-lg sm:border border-gray-800 bg-transparent sm:bg-[#111]">
              {/* Mobile View */}
              <div className="block sm:hidden divide-y divide-gray-800 border-t border-b border-gray-800">
                {results.map((result) => (
                  <MobileCard
                    key={`${result.stock_code}-${result.created_at}`}
                    result={result}
                    onClick={() => handleStockClick(result.stock_code)}
                  />
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800/50 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Mã CP</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Tín hiệu</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Giá vào</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Mục tiêu</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Tiềm năng</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Tin cậy</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">R:R</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Độ mạnh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {results.map((result) => (
                      <DesktopRow
                        key={`${result.stock_code}-${result.created_at}`}
                        result={result}
                        onClick={() => handleStockClick(result.stock_code)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/30 rounded-lg p-6 text-center mx-3 sm:mx-0">
              <p className="text-gray-400 text-sm">Không có kết quả cho bộ lọc này</p>
            </div>
          )}
        </>
      )}

      {/* Results count */}
      {!loading && !error && results.length > 0 && (
        <div className="mt-3 text-center text-gray-500 text-xs">
          Hiển thị {results.length} kết quả
        </div>
      )}
    </div>
  )
}

export default memo(SignalScreenerWidget)
