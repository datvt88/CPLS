'use client'

import { useState, useEffect } from 'react'
import { fetchStockRecommendations } from '@/services/vndirect'
import type { StockRecommendation } from '@/types/vndirect'

interface StockRecommendationsWidgetProps {
  symbol: string
}

export default function StockRecommendationsWidget({ symbol }: StockRecommendationsWidgetProps) {
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ buy: 0, hold: 0, sell: 0 })

  useEffect(() => {
    if (!symbol) return

    const loadRecommendations = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get recommendations from the last 12 months
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
        const startDate = twelveMonthsAgo.toISOString().split('T')[0]

        const response = await fetchStockRecommendations(symbol, startDate, 100)

        setRecommendations(response.data)

        // Calculate statistics
        const buy = response.data.filter(r => r.type === 'BUY').length
        const hold = response.data.filter(r => r.type === 'HOLD').length
        const sell = response.data.filter(r => r.type === 'SELL').length
        setStats({ buy, hold, sell })
      } catch (err) {
        console.error('Error loading recommendations:', err)
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

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'N/A'

    // If price is greater than 1000, it's likely in VND (thousands)
    if (price >= 1000) {
      return `${(price / 1000).toFixed(1)}k`
    }

    return price.toFixed(2)
  }

  const calculatePotential = (reportPrice: number | undefined, targetPrice: number) => {
    if (!reportPrice || !targetPrice) return null

    // Normalize prices (handle case where targetPrice might be in thousands)
    const normalizedTarget = targetPrice >= 1000 ? targetPrice / 1000 : targetPrice
    const normalizedReport = reportPrice >= 1000 ? reportPrice / 1000 : reportPrice

    const potential = ((normalizedTarget - normalizedReport) / normalizedReport) * 100
    return potential
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải đánh giá từ các CTCK...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  const avgTargetPrice = recommendations.length > 0 ? recommendations[0].avgTargetPrice : 0
  const total = stats.buy + stats.hold + stats.sell

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          💼 Đánh giá từ Công ty Chứng khoán - {symbol}
        </h3>
        <p className="text-gray-400 text-sm">
          Tổng hợp đánh giá và khuyến nghị đầu tư từ các công ty chứng khoán trong 12 tháng gần nhất
        </p>
      </div>

      {/* Statistics Summary */}
      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="text-gray-400 text-sm mb-1">Tổng đánh giá</div>
            <div className="text-2xl font-bold text-white">{total}</div>
          </div>
          <div className="bg-green-900/20 rounded-lg p-4 border border-green-700/30">
            <div className="text-green-400 text-sm mb-1 flex items-center gap-1">
              <span>📈</span> MUA
            </div>
            <div className="text-2xl font-bold text-green-400">
              {stats.buy} <span className="text-sm text-green-400/70">({((stats.buy / total) * 100).toFixed(0)}%)</span>
            </div>
          </div>
          <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-700/30">
            <div className="text-yellow-400 text-sm mb-1 flex items-center gap-1">
              <span>🤝</span> NẮM GIỮ
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {stats.hold} <span className="text-sm text-yellow-400/70">({((stats.hold / total) * 100).toFixed(0)}%)</span>
            </div>
          </div>
          <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30">
            <div className="text-purple-400 text-sm mb-1">Giá mục tiêu TB</div>
            <div className="text-2xl font-bold text-purple-400">{formatPrice(avgTargetPrice)}</div>
          </div>
        </div>
      )}

      {/* Recommendations List */}
      {recommendations.length === 0 ? (
        <div className="bg-gray-800/30 rounded-lg p-8 text-center border border-gray-700/50">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-400">Chưa có đánh giá nào trong 12 tháng gần nhất</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec, index) => {
            const badge = getRecommendationBadge(rec.type)
            const potential = calculatePotential(rec.reportPrice, rec.targetPrice)

            return (
              <div
                key={index}
                className={`rounded-lg p-4 border transition-all hover:shadow-lg ${getRecommendationColor(rec.type)}`}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  {/* Left side: Firm and Analyst info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-2xl font-bold ${badge.color} flex items-center gap-1`}>
                        {badge.icon} {badge.label}
                      </span>
                      <div className="h-6 w-px bg-gray-600"></div>
                      <div>
                        <div className="font-bold text-white">{rec.firm}</div>
                        <div className="text-xs text-gray-400">{rec.source}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-400">Phân tích viên:</span> {rec.analyst}
                    </div>
                  </div>

                  {/* Right side: Prices and Date */}
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3">
                      {rec.reportPrice && (
                        <div className="text-center bg-gray-900/50 rounded px-3 py-2">
                          <div className="text-xs text-gray-400 mb-1">Giá báo cáo</div>
                          <div className="font-bold text-white">{formatPrice(rec.reportPrice)}</div>
                        </div>
                      )}
                      <div className="text-center bg-gray-900/50 rounded px-3 py-2">
                        <div className="text-xs text-gray-400 mb-1">Giá mục tiêu</div>
                        <div className="font-bold text-white">{formatPrice(rec.targetPrice)}</div>
                      </div>
                    </div>

                    {/* Potential */}
                    {potential !== null && (
                      <div className="text-center bg-gray-900/50 rounded px-3 py-2 min-w-[80px]">
                        <div className="text-xs text-gray-400 mb-1">Tiềm năng</div>
                        <div className={`font-bold ${potential >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {potential >= 0 ? '+' : ''}{potential.toFixed(1)}%
                        </div>
                      </div>
                    )}

                    {/* Date */}
                    <div className="text-center bg-gray-900/50 rounded px-3 py-2 min-w-[100px]">
                      <div className="text-xs text-gray-400 mb-1">Ngày báo cáo</div>
                      <div className="text-sm font-medium text-white">{formatDate(rec.reportDate)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
