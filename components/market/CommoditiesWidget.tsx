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
      <div className="bg-panel border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="font-semibold text-lg">Giá hàng hóa thế giới</h3>
          <p className="text-sm text-muted">Vàng, Bạc, Dầu, Cao su, Urea, Cà phê</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 text-sm">
              <tr>
                <th className="text-left p-3">Hàng hóa</th>
                <th className="text-left p-3">Đơn vị</th>
                <th className="text-right p-3 font-semibold">Giá hiện tại</th>
                <th className="text-right p-3 font-semibold">Thay đổi</th>
                <th className="text-right p-3 font-semibold">% Thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {commodities.map((commodity) => (
                <tr key={commodity.code} className="hover:bg-gray-900 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCommodityIcon(commodity.code)}</span>
                      <span className="font-semibold text-base">{commodity.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted">{commodity.unit}</td>
                  <td className={'p-3 text-right font-bold text-xl ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {commodity.lastPrice.toFixed(2)}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {commodity.change > 0 ? '▲ +' : commodity.change < 0 ? '▼ ' : '● '}{commodity.change.toFixed(2)}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + (commodity.change > 0 ? 'text-green-500' : commodity.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {commodity.change > 0 ? '+' : ''}{commodity.changePercent.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
