'use client'

import { useEffect, useState } from 'react'

interface TopStock {
  code: string
  index: string
  lastPrice: number
  lastUpdated: string
  priceChgCr1D: number
  priceChgPctCr1D: number
  accumulatedVal: number
  nmVolumeAvgCr20D: number
}

interface APIResponse {
  data: TopStock[]
}

type Exchange = 'HOSE' | 'HNX' | 'VN30'

const API_URLS: Record<Exchange, string> = {
  HOSE: 'https://api-finfo.vndirect.com.vn/v4/top_stocks?q=index:VNIndex~lastPrice:gte:6~nmVolumeAvgCr20D:gte:100000~priceChgPctCr1D:gt:0&size=10&sort=priceChgPctCr1D',
  HNX: 'https://api-finfo.vndirect.com.vn/v4/top_stocks?q=index:HNX~lastPrice:gte:6~nmVolumeAvgCr20D:gte:100000~priceChgPctCr1D:gt:0&size=10&sort=priceChgPctCr1D',
  VN30: 'https://api-finfo.vndirect.com.vn/v4/top_stocks?q=index:VN30~lastPrice:gte:6~nmVolumeAvgCr20D:gte:100000~priceChgPctCr1D:gt:0&size=10&sort=priceChgPctCr1D',
}

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(2)}M`
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(2)}K`
  }
  return volume.toFixed(0)
}

const isCeilingPrice = (pctChange: number, exchange: Exchange): boolean => {
  // HNX: Giá trần khi gần 10% (9.8% - 10.2%)
  if (exchange === 'HNX') {
    return pctChange >= 9.8 && pctChange <= 10.2
  }

  // HOSE và VN30: Giá trần khi gần 7% (6.85% - 7.1%)
  if (exchange === 'HOSE' || exchange === 'VN30') {
    return pctChange >= 6.85 && pctChange <= 7.1
  }

  return false
}

const getPriceColor = (pctChange: number, exchange: Exchange): string => {
  if (isCeilingPrice(pctChange, exchange)) return 'text-purple-500'
  if (pctChange > 0) return 'text-green-500'
  if (pctChange < 0) return 'text-red-500'
  return 'text-yellow-500'
}

interface TopStocksWidgetProps {
  isActive?: boolean
}

export default function TopStocksWidget({ isActive = true }: TopStocksWidgetProps) {
  const [activeExchange, setActiveExchange] = useState<Exchange>('HOSE')
  const [stocks, setStocks] = useState<TopStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const fetchTopStocks = async (exchange: Exchange) => {
    // Only show loading on first load
    if (stocks.length === 0) {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch(API_URLS[exchange])
      if (!response.ok) throw new Error('Failed to fetch data')

      const data: APIResponse = await response.json()
      setStocks(data.data || [])
    } catch (err) {
      console.error('Error fetching top stocks:', err)
      // Only show error if we have no data yet
      if (stocks.length === 0) {
        setError('Không thể tải dữ liệu')
      }
      // Keep old data if update fails
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isActive) {
      fetchTopStocks(activeExchange)
      // Auto refresh every 3 seconds only when tab is active
      const interval = setInterval(() => fetchTopStocks(activeExchange), 3000)
      return () => clearInterval(interval)
    }
  }, [activeExchange, mounted, isActive])

  // Only show loading skeleton on initial load
  if (!mounted || (loading && stocks.length === 0)) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="h-10 bg-gray-700 rounded w-full"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 transition-all duration-300">
      <h3 className="text-xl font-bold mb-4 text-white">🚀 Top 10 cổ phiếu tăng giá</h3>

      {/* Exchange Tabs */}
      <div className="flex gap-2 mb-4">
        {(['HOSE', 'HNX', 'VN30'] as Exchange[]).map((exchange) => (
          <button
            key={exchange}
            onClick={() => setActiveExchange(exchange)}
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all duration-300 text-sm
              ${
                activeExchange === exchange
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
              }
            `}
          >
            {exchange}
          </button>
        ))}
      </div>

      {error && stocks.length === 0 ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : stocks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">Không có dữ liệu</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-2 text-gray-400 font-semibold">#</th>
                <th className="text-left py-3 px-2 text-gray-400 font-semibold">Mã</th>
                <th className="text-center py-3 px-2 text-gray-400 font-semibold">Sàn</th>
                <th className="text-right py-3 px-2 text-gray-400 font-semibold">Giá</th>
                <th className="text-right py-3 px-2 text-gray-400 font-semibold">Thay đổi</th>
                <th className="text-right py-3 px-2 text-gray-400 font-semibold">%</th>
                <th className="text-right py-3 px-2 text-gray-400 font-semibold">KL TB 20D</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, index) => {
                const isCeiling = isCeilingPrice(stock.priceChgPctCr1D, activeExchange)
                const colorClass = getPriceColor(stock.priceChgPctCr1D, activeExchange)

                return (
                  <tr
                    key={stock.code}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-all duration-300"
                  >
                    <td className="py-3 px-2 text-gray-400">#{index + 1}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${colorClass}`}>
                          {stock.code}
                        </span>
                        {isCeiling && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-semibold">
                            Trần
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-gray-300">
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">
                        {activeExchange}
                      </span>
                    </td>
                    <td className={`py-3 px-2 text-right font-semibold ${colorClass}`}>
                      {stock.lastPrice.toFixed(2)}
                    </td>
                    <td className={`py-3 px-2 text-right font-semibold ${colorClass}`}>
                      +{stock.priceChgCr1D.toFixed(2)}
                    </td>
                    <td className={`py-3 px-2 text-right font-bold ${colorClass}`}>
                      +{stock.priceChgPctCr1D.toFixed(2)}%
                    </td>
                    <td className="py-3 px-2 text-right text-gray-300">
                      {formatVolume(stock.nmVolumeAvgCr20D)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
