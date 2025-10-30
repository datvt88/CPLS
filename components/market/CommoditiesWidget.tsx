'use client'
import { useEffect, useState } from 'react'
import { Commodity } from '@/types'

export default function CommoditiesWidget() {
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/change_prices?q=period:1D~code:SPOT_GOLDS,GEN1ST_BRENT_OIL,GEN1ST_WHEAT,GEN1ST_COFFEE,GEN1ST_SUGAR,GEN1ST_COTTON,GEN1ST_COPPER'
      )
      const data = await response.json()
      
      if (data.data) {
        const mappedData: Commodity[] = data.data.map((item: any) => ({
          code: item.code,
          name: getCommodityName(item.code),
          lastPrice: item.lastPrice || item.close || 0,
          change: item.change || 0,
          changePercent: item.pctChange || 0,
          unit: getCommodityUnit(item.code),
        }))
        setCommodities(mappedData)
        setError(null)
      }
    } catch (err) {
      setError('Không thể tải dữ liệu')
      console.error('Error fetching commodities:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const getCommodityName = (code: string) => {
    const names: Record<string, string> = {
      SPOT_GOLDS: 'Vàng',
      GEN1ST_BRENT_OIL: 'Dầu Brent',
      GEN1ST_WHEAT: 'Lúa mì',
      GEN1ST_COFFEE: 'Cà phê',
      GEN1ST_SUGAR: 'Đường',
      GEN1ST_COTTON: 'Bông',
      GEN1ST_COPPER: 'Đồng',
    }
    return names[code] || code
  }

  const getCommodityUnit = (code: string) => {
    const units: Record<string, string> = {
      SPOT_GOLDS: 'USD/oz',
      GEN1ST_BRENT_OIL: 'USD/barrel',
      GEN1ST_WHEAT: 'USD/bushel',
      GEN1ST_COFFEE: 'USD/lb',
      GEN1ST_SUGAR: 'USD/lb',
      GEN1ST_COTTON: 'USD/lb',
      GEN1ST_COPPER: 'USD/lb',
    }
    return units[code] || 'USD'
  }

  const getCommodityIcon = (code: string) => {
    const icons: Record<string, string> = {
      SPOT_GOLDS: '🥇',
      GEN1ST_BRENT_OIL: '🛢️',
      GEN1ST_WHEAT: '🌾',
      GEN1ST_COFFEE: '☕',
      GEN1ST_SUGAR: '🍬',
      GEN1ST_COTTON: '🧵',
      GEN1ST_COPPER: '🔶',
    }
    return icons[code] || '📦'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-8 text-red-400"><p>{error}</p></div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {commodities.map((commodity) => (
        <div key={commodity.code} className="bg-panel border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{getCommodityIcon(commodity.code)}</span>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{commodity.name}</h3>
              <p className="text-xs text-muted">{commodity.unit}</p>
            </div>
            <div className={'text-right ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
              <div className="text-xl font-bold">{commodity.lastPrice.toFixed(2)}</div>
              <div className="text-xs font-semibold">{commodity.change > 0 ? '+' : ''}{commodity.changePercent.toFixed(2)}%</div>
            </div>
          </div>
          <div className={'text-sm border-t border-gray-800 pt-2 ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
            <span className="font-medium">{commodity.change > 0 ? '▲' : commodity.change < 0 ? '▼' : '●'}</span>
            <span className="ml-2">{commodity.change > 0 ? '+' : ''}{commodity.change.toFixed(2)} {commodity.unit}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
