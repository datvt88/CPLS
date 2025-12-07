'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'

// --- Types ---
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

interface CachedData {
  data: StockData[]
  timestamp: number
}

// --- Constants & Utilities ---
// Cache duration: 2 minutes
const CACHE_DURATION = 2 * 60 * 1000
let globalCachedData: CachedData | null = null

// Pure utility functions (moved outside component to avoid recreation/useCallback overhead)
const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '-'
  try {
    const d = new Date(dateString)
    // Check if date is valid
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch {
    return '-'
  }
}

// --- Sub-components ---

// Memoized Row Component
const StockRow = memo(({ stock }: { stock: StockData }) => (
  <tr className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors group">
    <td className="py-3 px-4">
      <span className="font-bold text-white text-sm sm:text-base group-hover:text-blue-400 transition-colors">
        {stock.ticker}
      </span>
    </td>
    <td className="py-3 px-4 text-right text-green-400 font-semibold text-sm sm:text-base">
      {formatNumber(stock.ma30)}
    </td>
    <td className="py-3 px-4 text-yellow-400">
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-yellow-400/10 border border-yellow-400/20">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        <span className="hidden sm:inline font-medium">Golden Cross</span>
        <span className="sm:hidden text-xs font-medium">GC</span>
      </div>
    </td>
    <td className="py-3 px-4 text-gray-400 text-xs sm:text-sm">
      {formatDate(stock.timeCross)}
    </td>
  </tr>
))
StockRow.displayName = 'StockRow'

// Skeleton Loading Component for better UX
const SkeletonRow = () => (
  <tr className="border-b border-gray-800/50 animate-pulse">
    <td className="py-3 px-4"><div className="h-5 w-12 bg-gray-700 rounded" /></td>
    <td className="py-3 px-4"><div className="h-5 w-16 bg-gray-700 rounded ml-auto" /></td>
    <td className="py-3 px-4"><div className="h-6 w-24 bg-gray-700 rounded" /></td>
    <td className="py-3 px-4"><div className="h-5 w-20 bg-gray-700 rounded" /></td>
  </tr>
)

// --- Main Component ---
function GoldenCrossSignalsWidget() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStocks = useCallback(async () => {
    // Cache check immediately inside the function
    if (globalCachedData && Date.now() - globalCachedData.timestamp < CACHE_DURATION) {
      console.log('✅ Using cached signals data')
      setStocks(globalCachedData.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    console.log('🔄 Fetching fresh signals data...')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch('/api/signals/golden-cross', {
        signal: controller.signal,
        headers: { 'Cache-Control': 'public, max-age=120' },
        next: { revalidate: 120 } // Optimization for Next.js App Router
      })

      clearTimeout(timeoutId)

      if (!response.ok) throw new Error('Failed to fetch stocks')

      const data = await response.json()
      
      // Transform Data
      const rawData = data.data || {}
      const stockList: StockData[] = Object.keys(rawData).map(symbol => {
        const info = rawData[symbol]
        return {
          ticker: info.ticker || symbol,
          price: info.price,
          ma10: info.ma10,
          ma30: info.ma30,
          macdv: info.macdv,
          avgNmValue: info.avgNmValue,
          note: info.note,
          timeCross: info.crossDate || info.timeCross
        }
      })

      // Sort: Newest first
      stockList.sort((a, b) => {
        const tA = a.timeCross ? new Date(a.timeCross).getTime() : 0
        const tB = b.timeCross ? new Date(b.timeCross).getTime() : 0
        return tB - tA
      })

      // Update Cache & State
      globalCachedData = { data: stockList, timestamp: Date.now() }
      setStocks(stockList)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching stocks:', err)
        setError(err.message || 'Không thể tải dữ liệu')
      }
    } finally {
      // Only unset loading if not aborted (prevents flicker on strict mode double invoke)
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }

    // Cleanup function for useEffect
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const cleanup = fetchStocks()
    // Handle the promise returned by useCallback if needed, 
    // but here we primarily need the cleanup logic returned inside fetchStocks logic if we were calling it directly.
    // However, since fetchStocks is async, we need a slightly different pattern for pure cleanup:
    
    // The simplified pattern for useEffect calling an async function:
    const controller = new AbortController() 
    // Note: The logic inside fetchStocks handles its own controller, 
    // but simply calling it here is sufficient. 
    return () => controller.abort() // Placeholder for standard cleanup
  }, [fetchStocks])

  // --- Render Helpers ---

  const renderContent = () => {
    if (error) {
      return (
        <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 text-center animate-fadeIn">
          <p className="text-red-400 mb-3">{error}</p>
          <button
            onClick={() => fetchStocks()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-red-900/20"
          >
            Thử lại
          </button>
        </div>
      )
    }

    if (!loading && stocks.length === 0) {
      return (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 text-center text-blue-400">
          Chưa có mã cổ phiếu nào có tín hiệu Golden Cross hôm nay.
        </div>
      )
    }

    return (
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#111]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/50 text-gray-400 uppercase text-xs">
              <tr>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Mã CP</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Vùng Mua (MA30)</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap text-center sm:text-left">Tín hiệu</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading 
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : stocks.map((stock) => <StockRow key={stock.ticker} stock={stock} />)
              }
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] sm:rounded-xl p-4 sm:p-6 border-y sm:border border-gray-800 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">⚡</span> Golden Cross Signals
          </h3>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            {loading ? 'Đang cập nhật...' : `${stocks.length} mã tiềm năng từ hệ thống`}
          </p>
        </div>
        {/* Optional: Add Refresh Button or Last Updated Time here */}
      </div>

      {renderContent()}
    </div>
  )
}

export default memo(GoldenCrossSignalsWidget)
