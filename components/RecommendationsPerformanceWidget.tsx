'use client'

import { useState, useEffect } from 'react'
import { formatPrice } from '@/utils/formatters'

interface StockRecommendation {
  id: string
  symbol: string
  recommendedPrice: number
  currentPrice: number
  targetPrice?: string
  stopLoss?: string
  confidence: number
  aiSignal: string
  technicalAnalysis: string[]
  fundamentalAnalysis: string[]
  risks: string[]
  opportunities: string[]
  createdAt: string
  status: 'active' | 'completed' | 'stopped'
  lastUpdated?: string
}

interface PerformanceMetrics {
  totalRecommendations: number
  profitableCount: number
  lossCount: number
  avgReturn: number
  bestReturn: number
  worstReturn: number
  winRate: number
}

export default function RecommendationsPerformanceWidget() {
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'stopped'>('all')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchRecommendations()
  }, [filterStatus])

  const fetchRecommendations = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = filterStatus === 'all'
        ? '/api/signals/recommendations'
        : `/api/signals/recommendations?status=${filterStatus}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations')
      }

      const data = await response.json()
      setRecommendations(data.data)

      // Calculate metrics
      calculateMetrics(data.data)
    } catch (err: any) {
      console.error('Error fetching recommendations:', err)
      setError(err.message || 'Không thể tải khuyến nghị')
    } finally {
      setLoading(false)
    }
  }

  const calculateMetrics = (recs: StockRecommendation[]) => {
    if (recs.length === 0) {
      setMetrics(null)
      return
    }

    let profitableCount = 0
    let lossCount = 0
    let totalReturn = 0
    let bestReturn = -Infinity
    let worstReturn = Infinity

    recs.forEach(rec => {
      const returnPercent = ((rec.currentPrice - rec.recommendedPrice) / rec.recommendedPrice) * 100
      totalReturn += returnPercent

      if (returnPercent > 0) {
        profitableCount++
      } else if (returnPercent < 0) {
        lossCount++
      }

      if (returnPercent > bestReturn) {
        bestReturn = returnPercent
      }

      if (returnPercent < worstReturn) {
        worstReturn = returnPercent
      }
    })

    const avgReturn = totalReturn / recs.length
    const winRate = (profitableCount / recs.length) * 100

    setMetrics({
      totalRecommendations: recs.length,
      profitableCount,
      lossCount,
      avgReturn,
      bestReturn: bestReturn === -Infinity ? 0 : bestReturn,
      worstReturn: worstReturn === Infinity ? 0 : worstReturn,
      winRate
    })
  }

  const updateAllPrices = async () => {
    setUpdating(true)

    try {
      // This would call the backend to update all prices
      // For now, we'll fetch current prices manually
      const updatePromises = recommendations.map(async rec => {
        try {
          const response = await fetch(`/api/vndirect/prices?symbol=${rec.symbol}&days=1`)
          const data = await response.json()

          if (data.data && data.data.length > 0) {
            const currentPrice = data.data[0].adClose

            // Update via API
            await fetch('/api/signals/recommendations', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: rec.id,
                currentPrice
              })
            })

            return { ...rec, currentPrice }
          }

          return rec
        } catch (error) {
          console.error(`Error updating ${rec.symbol}:`, error)
          return rec
        }
      })

      const updatedRecs = await Promise.all(updatePromises)
      setRecommendations(updatedRecs)
      calculateMetrics(updatedRecs)
    } catch (error) {
      console.error('Error updating prices:', error)
    } finally {
      setUpdating(false)
    }
  }

  const getReturnColor = (returnPercent: number) => {
    if (returnPercent > 5) return 'text-green-400'
    if (returnPercent > 0) return 'text-green-300'
    if (returnPercent < -5) return 'text-red-400'
    if (returnPercent < 0) return 'text-red-300'
    return 'text-gray-400'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">Đang theo dõi</span>
      case 'completed':
        return <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Đạt mục tiêu</span>
      case 'stopped':
        return <span className="px-2 py-1 bg-red-600 text-white text-xs rounded">Cắt lỗ</span>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải hiệu quả khuyến nghị...</p>
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

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            📊 Hiệu quả Khuyến nghị
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Theo dõi và đánh giá các khuyến nghị mua đã lưu
          </p>
        </div>
        <button
          onClick={updateAllPrices}
          disabled={updating}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
        >
          {updating ? '🔄 Đang cập nhật...' : '🔄 Cập nhật giá'}
        </button>
      </div>

      {/* Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-lg p-4 border border-blue-700/30">
            <div className="text-xs text-gray-400 mb-1">Tổng khuyến nghị</div>
            <div className="text-2xl font-bold text-white">{metrics.totalRecommendations}</div>
          </div>

          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-lg p-4 border border-green-700/30">
            <div className="text-xs text-gray-400 mb-1">Tỷ lệ thắng</div>
            <div className="text-2xl font-bold text-green-400">{metrics.winRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-400 mt-1">{metrics.profitableCount} lãi / {metrics.lossCount} lỗ</div>
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-lg p-4 border border-purple-700/30">
            <div className="text-xs text-gray-400 mb-1">Lợi nhuận TB</div>
            <div className={`text-2xl font-bold ${getReturnColor(metrics.avgReturn)}`}>
              {metrics.avgReturn > 0 ? '+' : ''}{metrics.avgReturn.toFixed(2)}%
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-lg p-4 border border-yellow-700/30">
            <div className="text-xs text-gray-400 mb-1">Tốt nhất / Tệ nhất</div>
            <div className="text-lg font-bold text-green-400">+{metrics.bestReturn.toFixed(2)}%</div>
            <div className="text-lg font-bold text-red-400">{metrics.worstReturn.toFixed(2)}%</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {['all', 'active', 'completed', 'stopped'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filterStatus === status
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {status === 'all' ? 'Tất cả' : status === 'active' ? 'Đang theo dõi' : status === 'completed' ? 'Đạt mục tiêu' : 'Cắt lỗ'}
          </button>
        ))}
      </div>

      {/* Recommendations List */}
      {recommendations.length === 0 ? (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 text-blue-400">
          Chưa có khuyến nghị nào được lưu
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const returnPercent = ((rec.currentPrice - rec.recommendedPrice) / rec.recommendedPrice) * 100
            const returnAmount = rec.currentPrice - rec.recommendedPrice

            return (
              <div
                key={rec.id}
                className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-lg p-5 border border-gray-700/50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-white">{rec.symbol}</div>
                    {getStatusBadge(rec.status)}
                    <div className="text-xs text-gray-400">
                      {new Date(rec.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-xl font-bold ${getReturnColor(returnPercent)}`}>
                      {returnPercent > 0 ? '+' : ''}{returnPercent.toFixed(2)}%
                    </div>
                    <div className={`text-sm ${getReturnColor(returnPercent)}`}>
                      {returnAmount > 0 ? '+' : ''}{formatPrice(returnAmount)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-700/30">
                    <div className="text-xs text-gray-400">Giá khuyến nghị</div>
                    <div className="text-sm font-semibold text-blue-400">{formatPrice(rec.recommendedPrice)}</div>
                  </div>
                  <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                    <div className="text-xs text-gray-400">Giá hiện tại</div>
                    <div className="text-sm font-semibold text-green-400">{formatPrice(rec.currentPrice)}</div>
                  </div>
                  {rec.targetPrice && (
                    <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-700/30">
                      <div className="text-xs text-gray-400">Mục tiêu</div>
                      <div className="text-sm font-semibold text-purple-400">{rec.targetPrice}</div>
                    </div>
                  )}
                  {rec.stopLoss && (
                    <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
                      <div className="text-xs text-gray-400">Cắt lỗ</div>
                      <div className="text-sm font-semibold text-red-400">{rec.stopLoss}</div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rec.technicalAnalysis && rec.technicalAnalysis.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-300 mb-2">Phân tích kỹ thuật:</div>
                      {rec.technicalAnalysis.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-400 pl-2 border-l-2 border-cyan-500/30 mb-1">
                          {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {rec.fundamentalAnalysis && rec.fundamentalAnalysis.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-300 mb-2">Phân tích cơ bản:</div>
                      {rec.fundamentalAnalysis.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-400 pl-2 border-l-2 border-purple-500/30 mb-1">
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
