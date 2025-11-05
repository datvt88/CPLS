'use client'

import { useEffect, useState } from 'react'
import type { WorldIndexData, VNDirectResponse } from '@/types/market'

const indexInfo: Record<string, { name: string; flag: string }> = {
  'DOWJONES': { name: 'Dow Jones', flag: '🇺🇸' },
  'NASDAQ': { name: 'Nasdaq', flag: '🇺🇸' },
  'NIKKEI225': { name: 'Nikkei 225', flag: '🇯🇵' },
  'SHANGHAI': { name: 'Shanghai', flag: '🇨🇳' },
  'HANGSENG': { name: 'Hang Seng', flag: '🇭🇰' },
  'FTSE100': { name: 'FTSE 100', flag: '🇬🇧' },
  'DAX': { name: 'DAX', flag: '🇩🇪' },
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

export default function WorldIndicesWidget() {
  const [indices, setIndices] = useState<WorldIndexData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const fetchWorldIndices = async () => {
    try {
      const response = await fetch('/api/market/world-indices')
      if (!response.ok) throw new Error('Failed to fetch world indices')

      const data: VNDirectResponse<WorldIndexData> = await response.json()
      setIndices(data.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching world indices:', err)
      setError('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
    fetchWorldIndices()
    const interval = setInterval(fetchWorldIndices, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
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
      <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        🌍 Thị trường thế giới
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {indices.map((index) => {
          const info = indexInfo[index.code]
          if (!info) return null

          return (
            <div
              key={index.code}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.flag}</span>
                  <span className="font-semibold text-white">{info.name}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold text-white">
                  {index.lastPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className={`text-sm font-semibold ${getPriceColor(index.priceChgCr1D)}`}>
                  {getPriceIcon(index.priceChgCr1D)}{' '}
                  {index.priceChgCr1D > 0 ? '+' : ''}
                  {index.priceChgCr1D.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ({index.priceChgPctCr1D > 0 ? '+' : ''}
                  {index.priceChgPctCr1D.toFixed(2)}%)
                </div>
              </div>

              {(index.highPrice || index.lowPrice || index.openPrice) && (
                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                  {index.openPrice && <div>Mở: {index.openPrice.toFixed(2)}</div>}
                  {index.highPrice && <div className="text-green-400">Cao: {index.highPrice.toFixed(2)}</div>}
                  {index.lowPrice && <div className="text-red-400">Thấp: {index.lowPrice.toFixed(2)}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {mounted && (
        <div className="mt-4 text-xs text-gray-500 text-right">
          Cập nhật: {new Date().toLocaleTimeString('vi-VN')}
        </div>
      )}
    </div>
  )
}
