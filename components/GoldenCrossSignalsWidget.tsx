'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'

// ... (Giữ nguyên phần Types, Constants & Utility Functions như cũ)
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

const CACHE_DURATION = 2 * 60 * 1000
let globalCachedData: CachedData | null = null

const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '-'
  try {
    const d = new Date(dateString)
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

// 1. Desktop Row (Dạng bảng cho màn hình lớn)
const DesktopRow = memo(({ stock }: { stock: StockData }) => (
  <tr className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors group">
    <td className="py-3 px-4">
      <span className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
        {stock.ticker}
      </span>
    </td>
    <td className="py-3 px-4 text-right text-green-400 font-semibold text-base">
      {formatNumber(stock.ma30)}
    </td>
    <td className="py-3 px-4 text-yellow-400">
      <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-yellow-400/10 border border-yellow-400/20">
        <span className="font-medium text-sm">Golden Cross</span>
      </div>
    </td>
    <td className="py-3 px-4 text-gray-400 text-sm text-right">
      {formatDate(stock.timeCross)}
    </td>
  </tr>
))
DesktopRow.displayName = 'DesktopRow'

// 2. Mobile Card (Dạng thẻ cho điện thoại)
const MobileCard = memo(({ stock }: { stock: StockData }) => (
  <div className="border-b border-gray-800 p-3 flex justify-between items-center bg-[#111] last:border-0">
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-bold text-white text-lg">{stock.ticker}</span>
        <span className="text-[10px] px-1.5 py-0.5 bg-yellow-900/30 text-yellow-400 rounded border border-yellow-700/30 font-medium">
          GC
        </span>
      </div>
      <span className="text-xs text-gray-500">{formatDate(stock.timeCross)}</span>
    </div>
    
    <div className="text-right">
      <div className="text-xs text-gray-400 mb-0.5">Vùng mua (MA30)</div>
      <div className="text-green-400 font-bold text-base font-mono">
        {formatNumber(stock.ma30)}
      </div>
    </div>
  </div>
))
MobileCard.displayName = 'MobileCard'

// 3. Skeleton Loading (Responsive)
const SkeletonLoader = () => (
  <>
    {/* Mobile Skeleton */}
    <div className="sm:hidden space-y-0 divide-y divide-gray-800">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-3 flex justify-between animate-pulse">
          <div className="space-y-2">
            <div className="h-6 w-12 bg-gray-800 rounded"></div>
            <div className="h-3 w-16 bg-gray-800 rounded"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 bg-gray-800 rounded ml-auto"></div>
            <div className="h-5 w-24 bg-gray-800 rounded ml-auto"></div>
          </div>
        </div>
      ))}
    </div>
    
    {/* Desktop Skeleton */}
    <table className="hidden sm:table w-full">
      <tbody>
        {Array.from({ length: 5 }).map((_, i) => (
          <tr key={i} className="border-b border-gray-800 animate-pulse">
            <td className="py-4 px-4"><div className="h-5 w-16 bg-gray-800 rounded"></div></td>
            <td className="py-4 px-4"><div className="h-5 w-20 bg-gray-800 rounded ml-auto"></div></td>
            <td className="py-4 px-4"><div className="h-6 w-32 bg-gray-800 rounded"></div></td>
            <td className="py-4 px-4"><div className="h-5 w-24 bg-gray-800 rounded ml-auto"></div></td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
)

// --- Main Component ---
function GoldenCrossSignalsWidget() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStocks = useCallback(async () => {
    if (globalCachedData && Date.now() - globalCachedData.timestamp < CACHE_DURATION) {
      setStocks(globalCachedData.data)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch('/api/signals/golden-cross', {
        signal: controller.signal,
        headers: { 'Cache-Control': 'public, max-age=120' },
        next: { revalidate: 120 }
      })

      clearTimeout(timeoutId)

      if (!response.ok) throw new Error('Failed to fetch stocks')

      const data = await response.json()
      
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

      stockList.sort((a, b) => {
        const tA = a.timeCross ? new Date(a.timeCross).getTime() : 0
        const tB = b.timeCross ? new Date(b.timeCross).getTime() : 0
        return tB - tA
      })

      globalCachedData = { data: stockList, timestamp: Date.now() }
      setStocks(stockList)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching stocks:', err)
        setError(err.message || 'Không thể tải dữ liệu')
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  useEffect(() => {
    const cleanup = fetchStocks()
    // No-op cleanup for useEffect calling async func pattern
    const controller = new AbortController()
    return () => controller.abort()
  }, [fetchStocks])

  const renderContent = () => {
    if (error) {
      return (
        <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-3 text-sm">{error}</p>
          <button onClick={() => fetchStocks()} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-semibold">Thử lại</button>
        </div>
      )
    }

    if (!loading && stocks.length === 0) {
      return (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 text-center text-blue-400 text-sm">
          Chưa có mã cổ phiếu nào có tín hiệu hôm nay.
        </div>
      )
    }

    if (loading) return <SkeletonLoader />

    return (
      <div className="overflow-hidden rounded-lg sm:border border-gray-800 bg-transparent sm:bg-[#111]">
        {/* MOBILE VIEW (Cards) */}
        <div className="block sm:hidden divide-y divide-gray-800 border-t border-b border-gray-800">
          {stocks.map((stock) => (
            <MobileCard key={stock.ticker} stock={stock} />
          ))}
        </div>

        {/* DESKTOP VIEW (Table) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/50 text-gray-400 uppercase text-xs">
              <tr>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Mã CP</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Vùng Mua (MA30)</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap text-left">Tín hiệu</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap text-right">Ngày</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stocks.map((stock) => (
                <DesktopRow key={stock.ticker} stock={stock} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    // Tối ưu padding: Trên mobile p-0 để tràn viền, trên PC có padding và bo góc
    <div className="bg-transparent sm:bg-[--panel] sm:rounded-xl sm:p-6 sm:border border-gray-800 sm:shadow-xl">
      <div className="flex items-center justify-between mb-4 sm:mb-6 px-2 sm:px-0">
        <div>
          <h3 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-400">⚡</span> Golden Cross Signals
          </h3>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            {loading ? 'Đang cập nhật...' : `${stocks.length} mã tiềm năng`}
          </p>
        </div>
      </div>

      {renderContent()}
    </div>
  )
}

export default memo(GoldenCrossSignalsWidget)
