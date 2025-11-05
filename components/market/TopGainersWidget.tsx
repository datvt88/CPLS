'use client'

import { useEffect, useState } from 'react'
import type { TopGainerStock, VNDirectResponse } from '@/types/market'

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`
  }
  return volume.toFixed(0)
}

const isCeilingPrice = (pctChange: number): boolean => {
  // HOSE/HNX: 6.85% - 7.1%
  if (pctChange >= 6.85 && pctChange <= 7.1) return true
  // UPCOM: 14.8% - 15.2%
  if (pctChange >= 14.8 && pctChange <= 15.2) return true
  return false
}

const getPriceColor = (pctChange: number): string => {
  if (isCeilingPrice(pctChange)) return 'text-purple-500'
  if (pctChange > 0) return 'text-green-500'
  if (pctChange < 0) return 'text-red-500'
  return 'text-yellow-500'
}

const getExchange = (index: string): string => {
  if (index.includes('VNINDEX')) return 'HOSE'
  if (index.includes('HNX')) return 'HNX'
  if (index.includes('UPCOM')) return 'UPCOM'
  return 'N/A'
}

export default function TopGainersWidget() {
  const [stocks, setStocks] = useState<TopGainerStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTopGainers = async () => {
    try {
      const response = await fetch('/api/market/top-gainers')
      if (!response.ok) throw new Error('Failed to fetch top gainers')

      const data: VNDirectResponse<TopGainerStock> = await response.json()
      setStocks(data.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching top gainers:', err)
      setError('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTopGainers()
    const interval = setInterval(fetchTopGainers, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-red-700">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl">
      <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
        🚀 Top 10 cổ phiếu tăng giá
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-2 text-gray-400 font-semibold">#</th>
              <th className="text-left py-3 px-2 text-gray-400 font-semibold">Mã</th>
              <th className="text-center py-3 px-2 text-gray-400 font-semibold">Sàn</th>
              <th className="text-right py-3 px-2 text-gray-400 font-semibold">Giá</th>
              <th className="text-right py-3 px-2 text-gray-400 font-semibold">Thay đổi</th>
              <th className="text-right py-3 px-2 text-gray-400 font-semibold">%</th>
              <th className="text-right py-3 px-2 text-gray-400 font-semibold">KL TB 20D</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock, index) => {
              const isCeiling = isCeilingPrice(stock.priceChgPctCr1D)
              const colorClass = getPriceColor(stock.priceChgPctCr1D)

              return (
                <tr
                  key={stock.code}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-3 px-2 text-gray-400">#{index + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${colorClass}`}>
                        {stock.code}
                      </span>
                      {isCeiling && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-semibold">
                          Trần
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center text-gray-300">
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                      {getExchange(stock.index)}
                    </span>
                  </td>
                  <td className={`py-3 px-2 text-right font-semibold ${colorClass}`}>
                    {stock.lastPrice.toFixed(2)}
                  </td>
                  <td className={`py-3 px-2 text-right font-semibold ${colorClass}`}>
                    +{stock.priceChgCr1D.toFixed(2)}
                  </td>
                  <td className={`py-3 px-2 text-right font-bold ${colorClass}`}>
                    +{stock.priceChgPctCr1D.toFixed(2)}%
                  </td>
                  <td className="py-3 px-2 text-right text-gray-300">
                    {formatVolume(stock.nmVolumeAvgCr20D)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500 text-right">
        Cập nhật: {new Date().toLocaleTimeString('vi-VN')}
      </div>
    </div>
  )
}
