'use client'

import { useState, useEffect, memo } from 'react'

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

// Memoized commodity card component
const CommodityCard = memo(({ commodity, info }: { commodity: CommodityData; info: CommodityInfo }) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors duration-300 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{info.icon}</span>
        <div>
          <div className="font-semibold text-white">{commodity.name}</div>
          <div className="text-xs text-gray-400">{info.unit}</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-bold text-white transition-all duration-500 ease-out">
          ${commodity.price.toFixed(2)}
        </div>
        <div className={`text-sm font-semibold transition-all duration-500 ease-out ${getPriceColor(commodity.change)}`}>
          {getIcon(commodity.change)} {commodity.change > 0 ? '+' : ''}${commodity.change.toFixed(2)} ({commodity.changePct > 0 ? '+' : ''}{commodity.changePct.toFixed(2)}%)
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if data actually changed
  return (
    prevProps.commodity.price === nextProps.commodity.price &&
    prevProps.commodity.change === nextProps.commodity.change &&
    prevProps.commodity.changePct === nextProps.commodity.changePct
  )
})

CommodityCard.displayName = 'CommodityCard'

interface SimpleCommoditiesWidgetProps {
  isActive?: boolean
}

export default function SimpleCommoditiesWidget({ isActive = true }: SimpleCommoditiesWidgetProps) {
  const [commodities, setCommodities] = useState<CommodityData[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !isActive) return

    const fetchCommodities = async () => {
      try {
        const response = await fetch('/api/market/commodities')
        const data = await response.json()
        setCommodities(data.data || [])
      } catch (error) {
        console.error('Error fetching commodities:', error)
        // Keep old data if update fails
      } finally {
        setLoading(false)
      }
    }

    fetchCommodities()
    // Auto refresh every 3 seconds only when tab is active
    const interval = setInterval(fetchCommodities, 3000)

    return () => clearInterval(interval)
  }, [mounted, isActive])

  // Only show loading skeleton on initial load
  if (!mounted || (loading && commodities.length === 0)) {
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
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 transition-all duration-300">
      <h3 className="text-xl font-bold mb-6 text-white">🛢️ Hàng hóa</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commodities.map((commodity) => {
          const info = commodityInfo[commodity.code]
          if (!info) return null

          return (
            <CommodityCard
              key={commodity.code}
              commodity={commodity}
              info={info}
            />
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
