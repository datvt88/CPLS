'use client'

import { useEffect, useState } from 'react'
import type { IndexData, VNDirectResponse } from '@/types/market'

const indexNames: Record<string, string> = {
  'VNINDEX': 'VN-Index',
  'HNX': 'HNX-Index',
  'UPCOM': 'UPCOM-Index',
  'VN30': 'VN30-Index',
  'VN30F1M': 'VN30F1M',
}

const getPriceColor = (change: number): string => {
  if (change > 0) return 'text-green-500'
  if (change < 0) return 'text-red-500'
  return 'text-yellow-500'
}

const getPriceIcon = (change: number): string => {
  if (change > 0) return '▲'
  if (change < 0) return '▼'
  return '▬'
}

export default function SecuritiesWidget() {
  const [indices, setIndices] = useState<IndexData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const fetchIndices = async () => {
    try {
      const response = await fetch('/api/market/indices')
      if (!response.ok) throw new Error('Failed to fetch indices')

      const data: VNDirectResponse<IndexData> = await response.json()
      setIndices(data.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching indices:', err)
      setError('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchIndices()
    const interval = setInterval(fetchIndices, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  // Don't render anything until mounted on client
  if (!mounted) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-red-800">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
        📊 Chỉ số chứng khoán
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </h3>

      <div className="space-y-3">
        {indices.map((index) => (
          <div
            key={index.code}
            className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-lg text-white">
                  {indexNames[index.code] || index.code}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Mở cửa: <span className="text-gray-300">{index.openPrice?.toFixed(2) || 'N/A'}</span>
                  {' | '}
                  Cao: <span className="text-green-400">{index.highPrice?.toFixed(2) || 'N/A'}</span>
                  {' | '}
                  Thấp: <span className="text-red-400">{index.lowPrice?.toFixed(2) || 'N/A'}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {index.lastPrice.toFixed(2)}
                </div>
                <div className={`text-sm font-semibold ${getPriceColor(index.priceChgCr1D)}`}>
                  {getPriceIcon(index.priceChgCr1D)}{' '}
                  {index.priceChgCr1D > 0 ? '+' : ''}{index.priceChgCr1D.toFixed(2)}{' '}
                  ({index.priceChgPctCr1D > 0 ? '+' : ''}{index.priceChgPctCr1D.toFixed(2)}%)
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
