'use client'
import { useEffect, useState } from 'react'

interface TopStock {
  code: string
  floor?: string
  price: number
  change: number
  changePct: number
  volume?: number
}

export default function TopGainersWidget() {
  const [stocks, setStocks] = useState<TopStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchData = async () => {
    try {
      // Try fetching from stocks API with filter
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/stocks?q=type:STOCK~floor:HOSE,HNX,UPCOM&size=10&page=1'
      )
      
      if (!response.ok) {
        throw new Error('API not available')
      }
      
      const data = await response.json()
      
      if (data.data && Array.isArray(data.data)) {
        const mappedData: TopStock[] = data.data.slice(0, 10).map((item: any) => ({
          code: item.code || item.symbol,
          floor: item.floor || item.exchange || 'HOSE',
          price: item.price || item.lastPrice || item.closePrice || 0,
          change: item.change || 0,
          changePct: item.changePct || item.pctChange || item.changePercent || 0,
          volume: item.volume || item.totalVolume || 0,
        }))
        setStocks(mappedData)
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'))
        setError(null)
      } else {
        setError('Dữ liệu không khả dụng')
      }
    } catch (err) {
      setError('API Top Gainers chưa được cấu hình')
      console.error('Error fetching top gainers:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return (volume / 1000000).toFixed(2) + 'M'
    if (volume >= 1000) return (volume / 1000).toFixed(2) + 'K'
    return volume.toString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 bg-panel border border-gray-800 rounded-lg p-6">
        <p className="text-yellow-500 mb-2">⚠️ {error}</p>
        <p className="text-sm text-muted">Widget này yêu cầu API endpoint riêng cho top gainers</p>
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="text-center py-8 bg-panel border border-gray-800 rounded-lg p-6">
        <p className="text-muted">Không có dữ liệu</p>
      </div>
    )
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
          <h3 className="font-semibold text-lg">Top cổ phiếu</h3>
          <p className="text-sm text-muted">Thị trường chứng khoán</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 text-sm">
              <tr>
                <th className="text-left p-3">Mã CK</th>
                <th className="text-left p-3">Sàn</th>
                <th className="text-right p-3 font-semibold">Giá hiện tại</th>
                <th className="text-right p-3 font-semibold">Thay đổi</th>
                <th className="text-right p-3 font-semibold">% Thay đổi</th>
                <th className="text-right p-3">KL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((stock, index) => (
                <tr key={stock.code} className="hover:bg-gray-900 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                      <span className="font-semibold text-base">{stock.code}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted">{stock.floor}</td>
                  <td className={'p-3 text-right font-bold text-lg ' + (stock.change > 0 ? 'text-green-500' : stock.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {stock.price.toFixed(2)}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + (stock.change > 0 ? 'text-green-500' : stock.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {stock.change > 0 ? '▲ +' : stock.change < 0 ? '▼ ' : '● '}{stock.change.toFixed(2)}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + (stock.changePct > 0 ? 'text-green-500' : stock.changePct < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {stock.changePct > 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right text-sm text-muted">{stock.volume ? formatVolume(stock.volume) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
