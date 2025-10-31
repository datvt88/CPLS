'use client'
import { useEffect, useState } from 'react'
import { MarketIndex } from '@/types'

export default function WorldIndicesWidget() {
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/change_prices?q=period:1D~code:DOWJONES,NASDAQ,NIKKEI225,SHANGHAI,HANGSENG,FTSE100,DAX'
      )
      const data = await response.json()
      
      if (data.data) {
        const mappedData: MarketIndex[] = data.data.map((item: any) => ({
          code: item.code,
          name: item.name || getIndexName(item.code),
          lastPrice: item.price || 0,
          change: item.change || 0,
          changePercent: item.changePct || 0,
        }))
        setIndices(mappedData)
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'))
        setError(null)
      }
    } catch (err) {
      setError('Không thể tải dữ liệu')
      console.error('Error fetching world indices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const getIndexName = (code: string) => {
    const names: Record<string, string> = {
      DOWJONES: 'Dow Jones',
      NASDAQ: 'Nasdaq',
      NIKKEI225: 'Nikkei 225',
      SHANGHAI: 'Shanghai SE',
      HANGSENG: 'Hang Seng',
      FTSE100: 'FTSE 100',
      DAX: 'DAX',
    }
    return names[code] || code
  }

  const getCountryFlag = (code: string) => {
    const flags: Record<string, string> = {
      DOWJONES: '🇺🇸',
      NASDAQ: '🇺🇸',
      NIKKEI225: '🇯🇵',
      SHANGHAI: '🇨🇳',
      HANGSENG: '🇭🇰',
      FTSE100: '🇬🇧',
      DAX: '🇩🇪',
    }
    return flags[code] || '🌍'
  }

  const getLocation = (code: string) => {
    const locations: Record<string, string> = {
      DOWJONES: 'USA',
      NASDAQ: 'USA',
      NIKKEI225: 'Japan',
      SHANGHAI: 'China',
      HANGSENG: 'Hong Kong',
      FTSE100: 'UK',
      DAX: 'Germany',
    }
    return locations[code] || ''
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
          <h3 className="font-semibold text-lg">Chỉ số chứng khoán thế giới</h3>
          <p className="text-sm text-muted">Dow Jones, Nasdaq, Nikkei, Shanghai...</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 text-sm">
              <tr>
                <th className="text-left p-3">Chỉ số</th>
                <th className="text-left p-3">Quốc gia</th>
                <th className="text-right p-3 font-semibold">Giá hiện tại</th>
                <th className="text-right p-3 font-semibold">Thay đổi</th>
                <th className="text-right p-3 font-semibold">% Thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {indices.map((index) => (
                <tr key={index.code} className="hover:bg-gray-900 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCountryFlag(index.code)}</span>
                      <span className="font-semibold text-base">{index.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted">{getLocation(index.code)}</td>
                  <td className={'p-3 text-right font-bold text-xl ' + (index.change > 0 ? 'text-green-500' : index.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {index.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + (index.change > 0 ? 'text-green-500' : index.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {index.change > 0 ? '▲ +' : index.change < 0 ? '▼ ' : '● '}{index.change.toFixed(2)}
                  </td>
                  <td className={'p-3 text-right font-bold text-base ' + (index.change > 0 ? 'text-green-500' : index.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {index.change > 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
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
