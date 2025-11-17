'use client'

import { useState, useEffect } from 'react'
import { fetchRecommendationsClient } from '@/services/vndirect-client'
import type { StockRecommendation } from '@/types/vndirect'
import { formatPrice as formatPriceUtil } from '@/utils/formatters'

interface StockRecommendationsWidgetProps {
  symbol: string
}

export default function StockRecommendationsWidget({ symbol }: StockRecommendationsWidgetProps) {
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ buy: 0, hold: 0, sell: 0 })
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!symbol) return

    // Reset states when symbol changes
    setShowAll(false)
    setRecommendations([])
    setStats({ buy: 0, hold: 0, sell: 0 })

    const loadRecommendations = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('📊 Loading recommendations for:', symbol)

        // Fetch recommendations directly from VNDirect (already sorted by reportDate:desc)
        const response = await fetchRecommendationsClient(symbol)

        console.log('✅ Recommendations loaded:', response.data.length, 'items')
        setRecommendations(response.data)

        // Calculate statistics
        const buy = response.data.filter(r => r.type === 'BUY').length
        const hold = response.data.filter(r => r.type === 'HOLD').length
        const sell = response.data.filter(r => r.type === 'SELL').length
        setStats({ buy, hold, sell })
      } catch (err) {
        console.error('❌ Error loading recommendations:', err)
        setError('Không tải được đánh giá từ các công ty chứng khoán')
      } finally {
        setLoading(false)
      }
    }

    loadRecommendations()
  }, [symbol])

  const getRecommendationColor = (type: string) => {
    switch (type) {
      case 'BUY':
        return 'bg-green-900/30 border-green-700/50 text-green-400'
      case 'HOLD':
        return 'bg-yellow-900/30 border-yellow-700/50 text-yellow-400'
      case 'SELL':
        return 'bg-red-900/30 border-red-700/50 text-red-400'
      default:
        return 'bg-gray-900/30 border-gray-700/50 text-gray-400'
    }
  }

  const getRecommendationBadge = (type: string) => {
    switch (type) {
      case 'BUY':
        return { label: 'MUA', icon: '📈', color: 'text-green-400' }
      case 'HOLD':
        return { label: 'NẮM GIỮ', icon: '🤝', color: 'text-yellow-400' }
      case 'SELL':
        return { label: 'BÁN', icon: '📉', color: 'text-red-400' }
      default:
        return { label: type, icon: '❓', color: 'text-gray-400' }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  // Use standardized price formatter
  const formatPrice = (price: number | undefined) => {
    return formatPriceUtil(price, 0)
  }

  const calculatePotential = (reportPrice: number | undefined, targetPrice: number) => {
    if (!reportPrice || !targetPrice) return null

    // Prices are already normalized to VND in the API
    const potential = ((targetPrice - reportPrice) / reportPrice) * 100
    return potential
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-400 text-sm">Đang tải đánh giá từ các CTCK...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      </div>
    )
  }

  const avgTargetPrice = recommendations.length > 0 ? recommendations[0].avgTargetPrice : 0
  const total = stats.buy + stats.hold + stats.sell
  const displayedRecommendations = showAll ? recommendations : recommendations.slice(0, 5)

  return (
    <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
      {/* Header with inline stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            💼 Đánh giá từ các Công ty Chứng khoán - {symbol}
          </h3>
          <p className="text-gray-400 text-xs mt-1">
            12 tháng gần nhất
          </p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Tổng:</span>
              <span className="font-bold text-white">{total}</span>
            </div>
            <div className="h-4 w-px bg-gray-700"></div>
            <div className="flex items-center gap-1">
              <span className="text-green-400">📈 {stats.buy}</span>
              <span className="text-gray-500">({((stats.buy / total) * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">🤝 {stats.hold}</span>
              <span className="text-gray-500">({((stats.hold / total) * 100).toFixed(0)}%)</span>
            </div>
            <div className="h-4 w-px bg-gray-700"></div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Giá TB:</span>
              <span className="font-bold text-purple-400">{formatPrice(avgTargetPrice)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations Table */}
      {recommendations.length === 0 ? (
        <div className="bg-gray-800/30 rounded-lg p-6 text-center border border-gray-700/50">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-gray-400 text-sm">Chưa có đánh giá nào trong 12 tháng gần nhất</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Khuyến nghị</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">CTCK</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium hidden md:table-cell">Phân tích viên</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Giá BC</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Giá MT</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Tiềm năng</th>
                <th className="text-right py-2 px-3 text-gray-400 font-medium">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {displayedRecommendations.map((rec, index) => {
                const badge = getRecommendationBadge(rec.type)
                const potential = calculatePotential(rec.reportPrice, rec.targetPrice)

                return (
                  <tr
                    key={index}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 font-bold ${badge.color}`}>
                        <span className="text-base">{badge.icon}</span>
                        <span className="text-xs">{badge.label}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-white">{rec.firm}</div>
                      <div className="text-xs text-gray-500">{rec.source}</div>
                    </td>
                    <td className="py-2 px-3 text-gray-300 hidden md:table-cell">{rec.analyst}</td>
                    <td className="py-2 px-3 text-right font-medium text-white">
                      {rec.reportPrice ? formatPrice(rec.reportPrice) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-white">
                      {formatPrice(rec.targetPrice)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {potential !== null ? (
                        <span className={`font-bold ${potential >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {potential >= 0 ? '+' : ''}{potential.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-400">
                      {formatDate(rec.reportDate)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Show more/less button */}
          {recommendations.length > 5 && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                {showAll ? '▲ Thu gọn' : `▼ Xem thêm ${recommendations.length - 5} đánh giá`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
