'use client'
import { useEffect, useState } from 'react'
import { TopStock } from '@/types'

export default function TopGainersWidget() {
  const [stocks, setStocks] = useState<TopStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/top_stocks?q=index:VNIndex~type:NetBuyVol,NetBuyVal,Value,Volume~order:Top&size=10'
      )
      const data = await response.json()
      
      if (data.data) {
        const mappedData: TopStock[] = data.data.slice(0, 10).map((item: any) => ({
          code: item.code,
          floor: item.floor || 'HOSE',
          lastPrice: item.lastPrice || item.price || 0,
          change: item.change || 0,
          changePercent: item.pctChange || item.changePercent || 0,
          volume: item.nmVolume || item.volume || 0,
          matchedVolume: item.matchedVolume,
        }))
        setStocks(mappedData)
        setError(null)
      }
    } catch (err) {
      setError('Không thể tải dữ liệu')
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
    return <div className="text-center py-8 text-red-400"><p>{error}</p></div>
  }

  return (
    <div className="bg-panel border border-gray-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="font-semibold text-lg">Top 10 Cổ phiếu tăng giá mạnh nhất</h3>
        <p className="text-sm text-muted">VN-Index</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900 text-sm">
            <tr>
              <th className="text-left p-3">Mã CK</th>
              <th className="text-left p-3">Sàn</th>
              <th className="text-right p-3">Giá</th>
              <th className="text-right p-3">Thay đổi</th>
              <th className="text-right p-3">%</th>
              <th className="text-right p-3">KL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {stocks.map((stock, index) => (
              <tr key={stock.code} className="hover:bg-gray-900 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">#{index + 1}</span>
                    <span className="font-semibold">{stock.code}</span>
                  </div>
                </td>
                <td className="p-3 text-sm text-muted">{stock.floor}</td>
                <td className="p-3 text-right font-medium">{stock.lastPrice.toFixed(2)}</td>
                <td className={'p-3 text-right font-medium ' + (stock.change > 0 ? 'text-green-500' : stock.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                  {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}
                </td>
                <td className={'p-3 text-right font-semibold ' + (stock.changePercent > 0 ? 'text-green-500' : stock.changePercent < 0 ? 'text-red-500' : 'text-yellow-500')}>
                  {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </td>
                <td className="p-3 text-right text-sm text-muted">{formatVolume(stock.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
