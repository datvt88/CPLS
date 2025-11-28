'use client'

import { useState, useEffect } from 'react'

interface StockProfitabilityWidgetProps {
  symbol: string
}

interface ProfitabilityData {
  x: string[]
  type: string
  unit: string
  data: Array<{
    id: number
    label: string
    tooltip: string
    type: string
    y: number[]
    yAxisPosition: string
  }>
}

export default function StockProfitabilityWidget({ symbol }: StockProfitabilityWidgetProps) {
  const [data, setData] = useState<ProfitabilityData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Reset all states when symbol changes
    setData(null)
    setError(null)
    setLoading(false)

    const loadProfitabilityData = async () => {
      setLoading(true)

      try {
        console.log('📊 Loading profitability data for:', symbol)

        // Use proxy API route to avoid CORS issues
        const response = await fetch(
          `/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`
        )

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const result = await response.json()
        console.log('✅ Profitability data loaded:', result)
        setData(result)
      } catch (err) {
        console.error('❌ Error loading profitability data:', err)

        let errorMessage = 'Không tải được dữ liệu hiệu quả hoạt động'
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

    loadProfitabilityData()
  }, [symbol])

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải hiệu quả hoạt động...</p>
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
          Không có dữ liệu hiệu quả hoạt động
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        📈 Hiệu quả hoạt động - {symbol}
      </h3>

      <div className="space-y-4">
        {data.data.map(metric => (
          <div key={metric.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-white font-semibold text-sm">{metric.label}</h4>
                <p className="text-gray-400 text-xs mt-1">{metric.tooltip}</p>
              </div>
            </div>

            {/* Table view for quarters */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-400 font-medium text-xs">Quý</th>
                    {data.x.slice().reverse().map((quarter, idx) => (
                      <th key={idx} className="text-right py-2 px-2 text-gray-400 font-medium text-xs">
                        {quarter}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2 px-2 text-gray-300 text-xs">{data.unit}</td>
                    {metric.y.slice().reverse().map((value, idx) => (
                      <td
                        key={idx}
                        className={`py-2 px-2 text-right font-semibold ${
                          value >= 20 ? 'text-green-400' : value >= 10 ? 'text-yellow-400' : 'text-red-400'
                        }`}
                      >
                        {value.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Visual bar chart */}
            <div className="mt-3 space-y-1">
              {metric.y.slice().reverse().map((value, idx) => {
                const reversedIdx = metric.y.length - 1 - idx
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16">{data.x[reversedIdx]}</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          value >= 20 ? 'bg-green-500' : value >= 10 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min((value / 30) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-semibold w-12 text-right ${
                      value >= 20 ? 'text-green-400' : value >= 10 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {value.toFixed(2)}%
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
