'use client'
import { useEffect, useState } from 'react'
import { MarketIndex } from '@/types'

export default function SecuritiesWidget() {
  const [indices, setIndices] = useState<MarketIndex[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/change_prices?q=code:VNINDEX,HNX,UPCOM,VN30,VN30F1M~period:1D'
      )
      const data = await response.json()
      
      if (data.data) {
        const mappedData: MarketIndex[] = data.data.map((item: any) => ({
          code: item.code,
          name: getIndexName(item.code),
          lastPrice: item.lastPrice || item.close || 0,
          change: item.change || 0,
          changePercent: item.pctChange || 0,
          high: item.high,
          low: item.low,
          open: item.open,
          volume: item.totalVolume,
        }))
        setIndices(mappedData)
        setError(null)
      }
    } catch (err) {
      setError('Không thể tải dữ liệu')
      console.error('Error fetching securities:', err)
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
      VNINDEX: 'VN-Index',
      HNX: 'HNX-Index',
      UPCOM: 'UPCOM-Index',
      VN30: 'VN30-Index',
      VN30F1M: 'VN30F1M',
    }
    return names[code] || code
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
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
    return <div className="text-center py-8 text-red-400"><p>{error}</p></div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {indices.map((index) => (
        <div key={index.code} className="bg-panel border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-lg">{index.code}</h3>
              <p className="text-sm text-muted">{index.name}</p>
            </div>
            <div className={'text-right ' + getChangeColor(index.change)}>
              <div className="text-xl font-bold">{index.lastPrice.toFixed(2)}</div>
              <div className="text-sm">{index.change > 0 ? '+' : ''}{index.change.toFixed(2)} ({index.changePercent > 0 ? '+' : ''}{index.changePercent.toFixed(2)}%)</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted border-t border-gray-800 pt-3">
            <div><div className="text-gray-500">Cao</div><div className="font-medium text-white">{index.high?.toFixed(2) || '-'}</div></div>
            <div><div className="text-gray-500">Thấp</div><div className="font-medium text-white">{index.low?.toFixed(2) || '-'}</div></div>
            <div><div className="text-gray-500">Mở cửa</div><div className="font-medium text-white">{index.open?.toFixed(2) || '-'}</div></div>
          </div>
        </div>
      ))}
    </div>
  )
}
