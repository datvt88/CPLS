'use client'
import { useEffect, useState } from 'react'

interface TopStock {
  code: string
  floor: string
  price: number
  change: number
  changePct: number
  volume: number
  isCeiling: boolean
}

export default function TopGainersWidget() {
  const [stocks, setStocks] = useState<TopStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/top_stocks?q=index:VNIndex~lastPrice:gte:6~nmVolumeAvgCr20D:gte:100000~priceChgPctCr1D:gt:0&size=10&sort=priceChgPctCr1D'
      )

      if (!response.ok) {
        throw new Error('API not available')
      }

      const data = await response.json()

      if (data.data && Array.isArray(data.data)) {
        const mappedData: TopStock[] = data.data.map((item: any) => ({
          code: item.code,
          floor: item.index || 'VNINDEX',
          price: item.lastPrice || 0,
          change: item.priceChgCr1D || 0,
          changePct: item.priceChgPctCr1D || 0,
          volume: item.nmVolumeAvgCr20D || 0,
          // Giá trần thường là ~6.9-7% cho HOSE/HNX, ~15% cho UPCOM
          isCeiling: (item.priceChgPctCr1D >= 6.85 && item.priceChgPctCr1D <= 7.1) ||
                     (item.priceChgPctCr1D >= 14.8 && item.priceChgPctCr1D <= 15.2),
        }))
        setStocks(mappedData)
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'))
        setError(null)
      } else {
        setError('Dữ liệu không khả dụng')
      }
    } catch (err) {
      setError('Không thể tải dữ liệu Top 10 cổ phiếu')
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

  const getColorClass = (stock: TopStock) => {
    if (stock.isCeiling) return 'text-purple-500'
    if (stock.change > 0) return 'text-green-500'
    if (stock.change < 0) return 'text-red-500'
    return 'text-yellow-500'
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
          <h3 className="font-semibold text-lg">Top 10 cổ phiếu tăng giá</h3>
          <p className="text-sm text-muted">VN-Index | Sắp xếp theo % tăng</p>
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
                      <span className={'font-semibold text-base ' + getColorClass(stock)}>{stock.code}</span>
                      {stock.isCeiling && <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-500 rounded">Trần</span>}
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted">{stock.floor}</td>
                  <td className={'p-3 text-right font-bold text-lg ' + getColorClass(stock)}>
                    {stock.price.toFixed(2)}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + getColorClass(stock)}>
                    {stock.change > 0 ? '▲ +' : stock.change < 0 ? '▼ ' : '● '}{stock.change.toFixed(2)}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + getColorClass(stock)}>
                    {stock.changePct > 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right text-sm text-muted">{formatVolume(stock.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
