'use client'

import { useState, useEffect } from 'react'

interface CommodityData {
  code: string
  name: string
  type: string
  period: string
  price: number
  bopPrice: number
  change: number
  changePct: number
  lastUpdated: string
}

interface CommodityInfo {
  icon: string
  unit: string
}

const commodityInfo: Record<string, CommodityInfo> = {
  'SPOT_GOLDS': { icon: '🥇', unit: 'USD/oz' },
  'GEN1ST_BRENT_OIL': { icon: '🛢️', unit: 'USD/barrel' },
}

export default function SimpleCommoditiesWidget() {
  const [commodities, setCommodities] = useState<CommodityData[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const fetchCommodities = async () => {
      try {
        const response = await fetch('/api/market/commodities')
        const data = await response.json()
        setCommodities(data.data || [])
      } catch (error) {
        console.error('Error fetching commodities:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCommodities()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCommodities, 30000)

    return () => clearInterval(interval)
  }, [mounted])

  const getPriceColor = (change: number) => {
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
    return 'text-yellow-500'
  }

  const getIcon = (change: number) => {
    if (change > 0) return '▲'
    if (change < 0) return '▼'
    return '▬'
  }

  if (!mounted || loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-xl font-bold mb-6 text-white">🛢️ Hàng hóa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 animate-pulse">
              <div className="h-20 bg-gray-700/50 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <h3 className="text-xl font-bold mb-6 text-white">🛢️ Hàng hóa</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commodities.map((commodity) => {
          const info = commodityInfo[commodity.code]
          if (!info) return null

          return (
            <div
              key={commodity.code}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{info.icon}</span>
                <div>
                  <div className="font-semibold text-white">{commodity.name}</div>
                  <div className="text-xs text-gray-400">{info.unit}</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold text-white">
                  ${commodity.price.toFixed(2)}
                </div>
                <div className={`text-sm font-semibold ${getPriceColor(commodity.change)}`}>
                  {getIcon(commodity.change)} {commodity.change > 0 ? '+' : ''}${commodity.change.toFixed(2)} ({commodity.changePct > 0 ? '+' : ''}{commodity.changePct.toFixed(2)}%)
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
    </div>
  )
}
