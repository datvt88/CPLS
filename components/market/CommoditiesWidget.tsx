'use client'
import { useEffect, useState } from 'react'
import { Commodity } from '@/types'

export default function CommoditiesWidget() {
  const [commodities, setCommodities] = useState<Commodity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/change_prices?q=period:1D~code:SPOT_GOLDS,SPOT_SILVER,GEN1ST_BRENT_OIL,GEN1ST_RUBBER,GEN1ST_UREA,GEN1ST_COFFEE_LONDON'
      )
      const data = await response.json()
      
      if (data.data) {
        const mappedData: Commodity[] = data.data.map((item: any) => ({
          code: item.code,
          name: item.name || getCommodityName(item.code),
          lastPrice: item.price || 0,
          change: item.change || 0,
          changePercent: item.changePct || 0,
          unit: getCommodityUnit(item.code),
        }))
        setCommodities(mappedData)
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'))
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
      SPOT_SILVER: 'Bạc',
      GEN1ST_BRENT_OIL: 'Dầu Brent',
      GEN1ST_RUBBER: 'Cao su',
      GEN1ST_UREA: 'Urea',
      GEN1ST_COFFEE_LONDON: 'Cà phê London',
    }
    return names[code] || code
  }

  const getCommodityUnit = (code: string) => {
    const units: Record<string, string> = {
      SPOT_GOLDS: 'USD/oz',
      SPOT_SILVER: 'USD/oz',
      GEN1ST_BRENT_OIL: 'USD/barrel',
      GEN1ST_RUBBER: 'USD/kg',
      GEN1ST_UREA: 'USD/ton',
      GEN1ST_COFFEE_LONDON: 'USD/ton',
    }
    return units[code] || 'USD'
  }

  const getCommodityIcon = (code: string) => {
    const icons: Record<string, string> = {
      SPOT_GOLDS: '🥇',
      SPOT_SILVER: '🥈',
      GEN1ST_BRENT_OIL: '🛢️',
      GEN1ST_RUBBER: '🏀',
      GEN1ST_UREA: '🧪',
      GEN1ST_COFFEE_LONDON: '☕',
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
    <div className="space-y-4">
      {lastUpdate && (
        <div className="text-xs text-muted text-right">
          Cập nhật lúc: {lastUpdate}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {commodities.map((commodity) => (
          <div key={commodity.code} className="bg-panel border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{getCommodityIcon(commodity.code)}</span>
              <div className="flex-1">
                <h3 className="font-semibold text-base">{commodity.name}</h3>
                <p className="text-xs text-muted">{commodity.unit}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className={'text-3xl font-bold ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                {commodity.lastPrice.toFixed(2)}
              </div>
              <div className="flex items-center gap-3">
                <div className={'text-base font-semibold ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                  {commodity.change > 0 ? '▲' : commodity.change < 0 ? '▼' : '●'} {commodity.change > 0 ? '+' : ''}{commodity.change.toFixed(2)}
                </div>
                <div className={'text-base font-semibold ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                  ({commodity.change > 0 ? '+' : ''}{commodity.changePercent.toFixed(2)}%)
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
