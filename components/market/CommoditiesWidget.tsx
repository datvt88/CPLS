'use client'

import { useEffect, useState } from 'react'
import type { CommodityData, VNDirectResponse } from '@/types/market'

const commodityInfo: Record<string, { name: string; icon: string; unit: string }> = {
  'SPOT_GOLDS': { name: 'Vàng', icon: '🥇', unit: 'USD/oz' },
  'GEN1ST_BRENT_OIL': { name: 'Dầu Brent', icon: '🛢️', unit: 'USD/barrel' },
  'WHEAT': { name: 'Lúa mì', icon: '🌾', unit: 'USD/bushel' },
  'COFFEE': { name: 'Cà phê', icon: '☕', unit: 'USD/lb' },
  'SUGAR': { name: 'Đường', icon: '🍬', unit: 'USD/lb' },
  'COTTON': { name: 'Bông', icon: '🧵', unit: 'USD/lb' },
  'COPPER': { name: 'Đồng', icon: '🔶', unit: 'USD/lb' },
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

export default function CommoditiesWidget() {
  const [commodities, setCommodities] = useState<CommodityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCommodities = async () => {
    try {
      const response = await fetch('/api/market/commodities')
      if (!response.ok) throw new Error('Failed to fetch commodities')

      const data: VNDirectResponse<CommodityData> = await response.json()
      setCommodities(data.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching commodities:', err)
      setError('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCommodities()
    const interval = setInterval(fetchCommodities, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
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
      <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        🛢️ Hàng hóa
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commodities.map((commodity) => {
          const info = commodityInfo[commodity.code]
          if (!info) return null

          return (
            <div
              key={commodity.code}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <div className="font-semibold text-white">{info.name}</div>
                    <div className="text-xs text-gray-400">{info.unit}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold text-white">
                  ${commodity.lastPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className={`text-sm font-semibold ${getPriceColor(commodity.priceChgCr1D)}`}>
                  {getPriceIcon(commodity.priceChgCr1D)}{' '}
                  {commodity.priceChgCr1D > 0 ? '+' : ''}
                  ${commodity.priceChgCr1D.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ({commodity.priceChgPctCr1D > 0 ? '+' : ''}
                  {commodity.priceChgPctCr1D.toFixed(2)}%)
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {commodities.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Không có dữ liệu hàng hóa
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-right">
        Cập nhật: {new Date().toLocaleTimeString('vi-VN')}
      </div>
    </div>
  )
}
