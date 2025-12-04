'use client'

import { useState, useEffect } from 'react'

interface BuyRecommendation {
  id: string
  symbol: string
  recommendedPrice: number
  currentPrice: number
  targetPrice?: number
  stopLoss?: number
  confidence: number
  aiSignal: string
  technicalAnalysis: string[]
  status: 'active' | 'completed' | 'stopped'
  createdAt: string
  updatedAt: string
  completedAt?: string
  gainLoss?: number
  gainLossPercent?: number
}

interface PerformanceMetrics {
  totalRecommendations: number
  activeRecommendations: number
  completedRecommendations: number
  stoppedRecommendations: number
  winRate: number
  averageGain: number
  averageLoss: number
  totalGainLoss: number
  bestPerformer: {
    symbol: string
    gainLossPercent: number
  } | null
  worstPerformer: {
    symbol: string
    gainLossPercent: number
  } | null
}

export default function RecommendationsHistoryWidget() {
  const [recommendations, setRecommendations] = useState<BuyRecommendation[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'stopped'>('all')

  useEffect(() => {
    fetchRecommendations()
    fetchMetrics()
  }, [filter])

  const fetchRecommendations = async () => {
    try {
      setLoading(true)
      const url = filter === 'all'
        ? '/api/signals/recommendations'
        : `/api/signals/recommendations?status=${filter}`

      const response = await fetch(url)
      const data = await response.json()

      if (response.ok && data.success) {
        setRecommendations(data.data || [])
        setError('')
      } else {
        setError(data.error || 'Không thể tải khuyến nghị')
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err)
      setError('Lỗi kết nối')
    } finally {
      setLoading(false)
    }
  }

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/signals/recommendations/performance')
      const data = await response.json()

      if (response.ok && data.success) {
        setMetrics(data.data)
      }
    } catch (err) {
      console.error('Error fetching metrics:', err)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price)
  }

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : ''
    return `${sign}${percent.toFixed(2)}%`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      stopped: 'bg-red-500/20 text-red-400 border-red-500/30',
    }
    const labels = {
      active: 'Đang theo dõi',
      completed: 'Hoàn thành',
      stopped: 'Cắt lỗ',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[--fg] mb-1">
            📊 Lịch sử Khuyến nghị Mua
          </h2>
          <p className="text-[--muted] text-sm">
            Theo dõi hiệu quả các khuyến nghị từ Golden Cross
          </p>
        </div>
        <button
          onClick={() => {
            fetchRecommendations()
            fetchMetrics()
          }}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all disabled:opacity-50 text-sm font-medium"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[--bg] p-4 rounded-lg border border-gray-700">
            <p className="text-[--muted] text-xs mb-1">Tổng số</p>
            <p className="text-[--fg] text-2xl font-bold">{metrics.totalRecommendations}</p>
          </div>
          <div className="bg-[--bg] p-4 rounded-lg border border-gray-700">
            <p className="text-[--muted] text-xs mb-1">Đang theo dõi</p>
            <p className="text-blue-400 text-2xl font-bold">{metrics.activeRecommendations}</p>
          </div>
          <div className="bg-[--bg] p-4 rounded-lg border border-gray-700">
            <p className="text-[--muted] text-xs mb-1">Tỷ lệ thắng</p>
            <p className="text-green-400 text-2xl font-bold">{metrics.winRate.toFixed(1)}%</p>
          </div>
          <div className="bg-[--bg] p-4 rounded-lg border border-gray-700">
            <p className="text-[--muted] text-xs mb-1">Lợi nhuận TB</p>
            <p className={`text-2xl font-bold ${metrics.totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatPercent(metrics.totalGainLoss / (metrics.completedRecommendations + metrics.stoppedRecommendations || 1))}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {['all', 'active', 'completed', 'stopped'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-[--bg] text-[--muted] hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'Tất cả' : f === 'active' ? 'Đang theo dõi' : f === 'completed' ? 'Hoàn thành' : 'Cắt lỗ'}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[--muted]">Đang tải...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-[--muted]">Chưa có khuyến nghị nào</p>
        </div>
      ) : (
        /* Recommendations Table */
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Mã CK</th>
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Giá MUA</th>
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Giá hiện tại</th>
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Cut Loss</th>
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Lãi/Lỗ</th>
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Độ tin cậy</th>
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Trạng thái</th>
                <th className="text-left py-3 px-4 text-[--muted] text-xs font-medium">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec) => (
                <tr key={rec.id} className="border-b border-gray-800 hover:bg-[--bg] transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-[--fg] font-bold">{rec.symbol}</p>
                      <p className="text-[--muted] text-xs mt-1">{rec.aiSignal}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[--fg] font-mono">{formatPrice(rec.recommendedPrice)}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[--fg] font-mono">{formatPrice(rec.currentPrice)}</p>
                  </td>
                  <td className="py-3 px-4">
                    {rec.stopLoss && (
                      <p className="text-red-400 font-mono">{formatPrice(rec.stopLoss)}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {rec.gainLossPercent !== undefined && (
                      <div className="flex items-center gap-2">
                        <p className={`font-bold ${rec.gainLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPercent(rec.gainLossPercent)}
                        </p>
                        {rec.gainLossPercent >= 0 ? (
                          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${rec.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-[--fg] text-xs font-medium">{rec.confidence}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(rec.status)}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-[--muted] text-xs">{formatDate(rec.createdAt)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Best/Worst Performers */}
      {metrics && (metrics.bestPerformer || metrics.worstPerformer) && (
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {metrics.bestPerformer && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm font-medium mb-2">🏆 Tốt nhất</p>
              <div className="flex items-center justify-between">
                <p className="text-[--fg] font-bold text-lg">{metrics.bestPerformer.symbol}</p>
                <p className="text-green-400 font-bold text-lg">
                  {formatPercent(metrics.bestPerformer.gainLossPercent)}
                </p>
              </div>
            </div>
          )}
          {metrics.worstPerformer && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm font-medium mb-2">📉 Tệ nhất</p>
              <div className="flex items-center justify-between">
                <p className="text-[--fg] font-bold text-lg">{metrics.worstPerformer.symbol}</p>
                <p className="text-red-400 font-bold text-lg">
                  {formatPercent(metrics.worstPerformer.gainLossPercent)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
