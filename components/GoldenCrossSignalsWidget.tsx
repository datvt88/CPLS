'use client'

import { useState, useEffect, useMemo, useCallback, memo } from 'react'

interface StockData {
  ticker: string
  price?: number
  ma10?: number
  ma30?: number
  macdv?: number
  avgNmValue?: number
  note?: string
  timeCross?: string
}

// Cache duration: 2 minutes
const CACHE_DURATION = 2 * 60 * 1000
let cachedData: { data: StockData[]; timestamp: number } | null = null

// Memoized stock row component for better rendering performance
const StockRow = memo(({ stock, formatNumber, formatDate }: { stock: StockData; formatNumber: (num: number | undefined) => string; formatDate: (date: string | undefined) => string }) => (
  <tr className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
    <td className="py-2 px-2 sm:py-3 sm:px-4">
      <span className="font-bold text-white text-sm sm:text-base">{stock.ticker}</span>
    </td>
    <td className="py-2 px-2 sm:py-3 sm:px-4 text-right text-green-400 font-semibold text-sm sm:text-base">
      {formatNumber(stock.ma30)}
    </td>
    <td className="py-2 px-2 sm:py-3 sm:px-4 text-yellow-400">
      <span className="inline-flex items-center gap-1 sm:gap-2">
        <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="hidden sm:inline">Golden Cross</span>
        <span className="sm:hidden text-xs">GC</span>
      </span>
    </td>
    <td className="py-2 px-2 sm:py-3 sm:px-4 text-gray-300 text-xs sm:text-sm">
      {formatDate(stock.timeCross)}
    </td>
  </tr>
))

StockRow.displayName = 'StockRow'

function GoldenCrossSignalsWidget() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStocksFromFirebase = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Check cache first
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
        console.log('✅ Using cached signals data')
        setStocks(cachedData.data)
        setLoading(false)
        return
      }

      console.log('🔄 Fetching fresh signals data...')

      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      try {
        // Get stock list from Firebase via API
        const response = await fetch('/api/signals/golden-cross', {
          signal: controller.signal,
          // Add cache headers for browser caching
          headers: {
            'Cache-Control': 'public, max-age=120', // 2 minutes
          },
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error('Failed to fetch stocks from Firebase')
        }

        const data = await response.json()

        // Extract stock data from Firebase
        const stockList: StockData[] = []
        if (data.data && typeof data.data === 'object') {
          // Firebase returns object with keys as stock symbols
          Object.keys(data.data).forEach(symbol => {
            const stockInfo = data.data[symbol]
            stockList.push({
              ticker: stockInfo.ticker || symbol,
              price: stockInfo.price,
              ma10: stockInfo.ma10,
              ma30: stockInfo.ma30,
              macdv: stockInfo.macdv,
              avgNmValue: stockInfo.avgNmValue,
              note: stockInfo.note,
              timeCross: stockInfo.crossDate || stockInfo.timeCross
            })
          })
        }

        // Sort by timeCross date - newest first
        stockList.sort((a, b) => {
          const dateA = a.timeCross ? new Date(a.timeCross).getTime() : 0
          const dateB = b.timeCross ? new Date(b.timeCross).getTime() : 0
          return dateB - dateA // Descending order (newest first)
        })

        // Update cache
        cachedData = {
          data: stockList,
          timestamp: Date.now()
        }

        setStocks(stockList)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error('Yêu cầu hết thời gian chờ. Vui lòng thử lại.')
        }
        throw fetchError
      }
    } catch (err: any) {
      console.error('Error fetching stocks:', err)
      setError(err.message || 'Không thể tải danh sách cổ phiếu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStocksFromFirebase()
  }, [fetchStocksFromFirebase])

  // Memoize formatNumber to prevent recreating on each render
  const formatNumber = useCallback((num: number | undefined) => {
    if (num === undefined || num === null) return '-'
    return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
  }, [])

  // Memoize formatDate to prevent recreating on each render
  const formatDate = useCallback((date: string | undefined) => {
    if (!date) return '-'
    try {
      const d = new Date(date)
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    } catch {
      return '-'
    }
  }, [])

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-none sm:rounded-xl p-4 sm:p-6 border-y sm:border border-gray-800">
        <div className="flex items-center justify-center h-60">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400 text-sm">Đang tải danh sách cổ phiếu...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-none sm:rounded-xl p-4 sm:p-6 border-y sm:border border-gray-800">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 sm:p-4">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => fetchStocksFromFirebase()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-[--panel] rounded-none sm:rounded-xl p-4 sm:p-6 border-y sm:border border-gray-800">
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
          📊 Danh sách mã cổ phiếu
        </h3>
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3 sm:p-4 text-blue-400 text-sm">
          Chưa có mã cổ phiếu nào trong danh sách
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-none sm:rounded-xl p-3 sm:p-6 border-y sm:border border-gray-800">
      <div className="mb-4 sm:mb-6 px-2 sm:px-0">
        <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          📊 Danh sách mã cổ phiếu
        </h3>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">
          {stocks.length} mã cổ phiếu từ Realtime Database
        </p>
      </div>

      <div className="overflow-x-auto -mx-3 sm:-mx-6">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-semibold text-gray-300 whitespace-nowrap">Mã CP</th>
                <th className="text-right py-2 px-2 sm:py-3 sm:px-4 font-semibold text-gray-300 whitespace-nowrap">Vùng Mua</th>
                <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-semibold text-gray-300 whitespace-nowrap">Tín hiệu</th>
                <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-semibold text-gray-300 whitespace-nowrap">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => (
                <StockRow key={stock.ticker} stock={stock} formatNumber={formatNumber} formatDate={formatDate} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Export memoized component for better performance
export default memo(GoldenCrossSignalsWidget)
