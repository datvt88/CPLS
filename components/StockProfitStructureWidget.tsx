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

  // Find max value for scaling bars
  const maxValue = Math.max(
    ...data.data.flatMap(metric => metric.y.map(v => Math.abs(v)))
  )

  return (
    <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        💰 Cơ cấu lợi nhuận - {symbol}
      </h3>

      <div className="space-y-4">
        {data.data.map(metric => (
          <div key={metric.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-white font-semibold text-sm">{metric.label}</h4>
                <p className="text-gray-400 text-xs mt-1">{metric.tooltip}</p>
              </div>
            </div>

            {/* Header row */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50">
              <span className="text-xs text-gray-400 w-16 font-medium">Quý</span>
              <div className="flex-1"></div>
              <span className="text-xs text-gray-400 w-20 text-right font-medium">Nghìn tỷ</span>
            </div>

            {/* Visual bar chart */}
            <div className="space-y-1">
              {metric.y.slice().reverse().map((value, idx) => {
                const reversedIdx = metric.y.length - 1 - idx
                const isNegative = value < 0
                const absValue = Math.abs(value)
                const percentage = (absValue / maxValue) * 100

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16">{data.x[reversedIdx]}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isNegative
                            ? 'bg-red-500'
                            : metric.id === 0
                              ? 'bg-purple-500'
                              : metric.id === 1
                                ? 'bg-blue-500'
                                : metric.id === 2
                                  ? 'bg-green-500'
                                  : metric.id === 3
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-semibold w-20 text-right ${
                      isNegative ? 'text-red-400' : 'text-white'
                    }`}>
                      {isNegative ? '-' : ''}{formatBillion(absValue)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
