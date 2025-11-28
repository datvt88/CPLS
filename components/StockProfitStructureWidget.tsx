'use client'

import { useState, useEffect } from 'react'

interface StockProfitStructureWidgetProps {
  symbol: string
}

interface ProfitStructureData {
  x: string[]
  type: string
  data: Array<{
    id: number
    label: string
    tooltip: string
    type: string
    y: number[]
    yAxisPosition: string
  }>
}

export default function StockProfitStructureWidget({ symbol }: StockProfitStructureWidgetProps) {
  const [data, setData] = useState<ProfitStructureData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Reset all states when symbol changes
    setData(null)
    setError(null)
    setLoading(false)

    const loadProfitStructureData = async () => {
      setLoading(true)

      try {
        console.log('📊 Loading profit structure data for:', symbol)

        // Use proxy API route to avoid CORS issues
        const response = await fetch(
          `/api/dnse/profit-structure?symbol=${symbol}&code=PROFIT_BEFORE_TAX&cycleType=quy&cycleNumber=5`
        )

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const result = await response.json()
        console.log('✅ Profit structure data loaded:', result)
        setData(result)
      } catch (err) {
        console.error('❌ Error loading profit structure data:', err)

        let errorMessage = 'Không tải được dữ liệu cơ cấu lợi nhuận'
        if (err instanceof Error) {
          if (err.message.includes('404')) {
            errorMessage = 'DNSE không có dữ liệu cho mã này'
          } else if (err.message.includes('403')) {
            errorMessage = 'Bị chặn truy cập API (403)'
          } else if (err.message.includes('500') || err.message.includes('502') || err.message.includes('503')) {
            errorMessage = 'DNSE API tạm thời không khả dụng'
          }
        }
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadProfitStructureData()
  }, [symbol])

  // Format large numbers to billions (tỷ đồng)
  const formatBillion = (value: number): string => {
    const billion = value / 1000000000000
    return billion.toFixed(2)
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải cơ cấu lợi nhuận...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="text-gray-400 text-center py-8">
          Không có dữ liệu cơ cấu lợi nhuận
        </div>
      </div>
    )
  }

  // Find max total value across all quarters for scaling
  const quarterTotals = data.x.map((_, qIdx) => {
    return data.data.reduce((sum, metric) => {
      const value = metric.y[qIdx] || 0
      return sum + Math.abs(value)
    }, 0)
  })
  const maxTotal = Math.max(...quarterTotals)

  // Get metric colors
  const getMetricColor = (metricId: number, isNegative: boolean) => {
    if (isNegative) return 'bg-red-500'

    switch (metricId) {
      case 0: return 'bg-purple-500'  // LN trước thuế
      case 1: return 'bg-blue-500'    // LN kinh doanh
      case 2: return 'bg-green-500'   // LN tài chính
      case 3: return 'bg-yellow-500'  // LN liên doanh
      case 4: return 'bg-gray-500'    // LN khác
      default: return 'bg-gray-400'
    }
  }

  const getMetricTextColor = (metricId: number, isNegative: boolean) => {
    if (isNegative) return 'text-red-400'

    switch (metricId) {
      case 0: return 'text-purple-400'
      case 1: return 'text-blue-400'
      case 2: return 'text-green-400'
      case 3: return 'text-yellow-400'
      case 4: return 'text-gray-400'
      default: return 'text-white'
    }
  }

  return (
    <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        💰 Cơ cấu lợi nhuận - {symbol}
      </h3>

      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b border-gray-700/50">
          {data.data.map(metric => (
            <div key={metric.id} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${getMetricColor(metric.id, false)}`}></div>
              <span className="text-xs text-gray-300">{metric.label}</span>
            </div>
          ))}
        </div>

        {/* Header row */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50">
          <span className="text-xs text-gray-400 w-16 font-medium">Quý</span>
          <div className="flex-1"></div>
          <span className="text-xs text-gray-400 w-20 text-right font-medium">Nghìn tỷ</span>
        </div>

        {/* Combined bar chart by quarter */}
        <div className="space-y-1">
          {[...data.x].reverse().map((quarter, qIdx) => {
            const originalIdx = data.x.length - 1 - qIdx

            // Calculate total for this quarter
            const quarterTotal = data.data.reduce((sum, metric) => {
              return sum + Math.abs(metric.y[originalIdx] || 0)
            }, 0)

            return (
              <div key={qIdx} className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-16">{quarter}</span>
                <div className="flex-1 flex gap-0.5">
                  {data.data.map(metric => {
                    const value = metric.y[originalIdx] || 0
                    const isNegative = value < 0
                    const absValue = Math.abs(value)
                    const percentage = maxTotal > 0 ? (absValue / maxTotal) * 100 : 0

                    if (percentage < 0.5) return null // Skip very small values

                    return (
                      <div
                        key={metric.id}
                        className={`h-4 ${getMetricColor(metric.id, isNegative)} transition-all`}
                        style={{ width: `${percentage}%` }}
                        title={`${metric.label}: ${isNegative ? '-' : ''}${formatBillion(absValue)} nghìn tỷ`}
                      ></div>
                    )
                  })}
                </div>
                <span className="text-xs font-semibold w-20 text-right text-white">
                  {formatBillion(quarterTotal)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
