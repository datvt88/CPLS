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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {indices.map((index) => (
          <div key={index.code} className="bg-panel border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getCountryFlag(index.code)}</span>
                <div>
                  <h3 className="font-semibold text-lg">{index.name}</h3>
                  <p className="text-xs text-muted">{getLocation(index.code)}</p>
                </div>
              </div>
              <div className={'text-right ' + (index.change > 0 ? 'text-green-500' : index.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                <div className="text-2xl font-bold">{index.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
            <div className={'text-sm font-semibold border-t border-gray-800 pt-3 ' + (index.change > 0 ? 'text-green-500' : index.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
              {index.change > 0 ? '▲' : index.change < 0 ? '▼' : '●'} {index.change > 0 ? '+' : ''}{index.change.toFixed(2)} ({index.change > 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
