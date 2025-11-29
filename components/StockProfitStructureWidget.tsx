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

interface EquityStructureData {
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
  const [equityData, setEquityData] = useState<EquityStructureData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Reset all states when symbol changes
    setData(null)
    setEquityData(null)
    setError(null)
    setLoading(false)

    const loadFinancialStructureData = async () => {
      setLoading(true)

      try {
        console.log('📊 Loading profit & equity structure data for:', symbol)

        // Fetch both profit structure and equity structure in parallel
        const [profitResponse, equityResponse] = await Promise.all([
          fetch(`/api/dnse/profit-structure?symbol=${symbol}&code=PROFIT_BEFORE_TAX&cycleType=quy&cycleNumber=5`),
          fetch(`/api/dnse/equity-structure?symbol=${symbol}&code=OWNERS_EQUITY&cycleType=quy&cycleNumber=5`)
        ])

        if (!profitResponse.ok) {
          throw new Error(`Profit API error: ${profitResponse.status}`)
        }

        if (!equityResponse.ok) {
          console.warn('⚠️ Equity data not available, continuing with profit data only')
        }

        const profitResult = await profitResponse.json()
        const equityResult = equityResponse.ok ? await equityResponse.json() : null

        console.log('✅ Profit structure data loaded:', profitResult)
        if (equityResult) {
          console.log('✅ Equity structure data loaded:', equityResult)
        }

        setData(profitResult)
        setEquityData(equityResult)
      } catch (err) {
        console.error('❌ Error loading financial structure data:', err)

        let errorMessage = 'Không tải được dữ liệu cơ cấu lợi nhuận & vốn chủ'
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

    loadFinancialStructureData()
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
            <p className="text-gray-400">Đang tải cơ cấu lợi nhuận & vốn chủ...</p>
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
          Không có dữ liệu cơ cấu lợi nhuận & vốn chủ
        </div>
      </div>
    )
  }

  // Separate "LN trước thuế" (total) from component profits
  const profitBeforeTax = data.data.find(m => m.id === 0)
  const componentProfits = data.data.filter(m => m.id !== 0)

  // Find max value for scaling (use LN trước thuế as reference)
  const maxTotal = profitBeforeTax
    ? Math.max(...profitBeforeTax.y.map(v => Math.abs(v)))
    : 0

  // Get metric colors
  const getMetricColor = (metricId: number, isNegative: boolean) => {
    switch (metricId) {
      case 0: return 'bg-purple-500'  // LN trước thuế
      case 1: return 'bg-blue-500'    // LN kinh doanh
      case 2: return 'bg-green-500'   // LN tài chính
      case 3: return 'bg-red-500'     // LN liên doanh - always red
      case 4: return 'bg-gray-500'    // LN khác - always gray
      default: return isNegative ? 'bg-red-500' : 'bg-gray-400'
    }
  }

  const getMetricTextColor = (metricId: number, isNegative: boolean) => {
    switch (metricId) {
      case 0: return 'text-purple-400'
      case 1: return 'text-blue-400'
      case 2: return 'text-green-400'
      case 3: return 'text-red-400'    // LN liên doanh - always red
      case 4: return 'text-gray-400'   // LN khác - always gray
      default: return isNegative ? 'text-red-400' : 'text-white'
    }
  }

  // Get equity metric colors
  const getEquityMetricColor = (metricId: number, isNegative?: boolean) => {
    if (isNegative) return 'bg-red-500'

    switch (metricId) {
      case 0: return 'bg-indigo-500'   // Vốn góp
      case 1: return 'bg-orange-500'   // Cổ phiếu quỹ
      case 2: return 'bg-teal-500'     // LNST chưa phân phối
      case 3: return 'bg-pink-500'     // Vốn khác
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        💰 Cơ cấu lợi nhuận & Vốn chủ - {symbol}
      </h3>

      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b border-gray-700/50">
          {data.data.map(metric => {
            // Show circle for LN trước thuế, square for others
            const isTotal = metric.id === 0
            return (
              <div key={metric.id} className="flex items-center gap-2">
                {isTotal ? (
                  <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-purple-300"></div>
                ) : (
                  <div className={`w-3 h-3 ${getMetricColor(metric.id, false)}`}></div>
                )}
                <span className="text-xs text-gray-300">{metric.label}</span>
              </div>
            )
          })}
        </div>

        {/* Header row */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50">
          <span className="text-xs text-gray-400 w-16 font-medium">Quý</span>
          <div className="flex-1"></div>
          <span className="text-xs text-gray-400 w-20 text-right font-medium">Nghìn tỷ</span>
        </div>

        {/* Combined bar chart by quarter with trend line overlay */}
        <div className="relative">
          <div className="space-y-1">
            {[...data.x].reverse().map((quarter, qIdx) => {
              const originalIdx = data.x.length - 1 - qIdx

              // Get LN trước thuế value for this quarter
              const totalValue = profitBeforeTax ? profitBeforeTax.y[originalIdx] || 0 : 0

              return (
                <div key={qIdx} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16">{quarter}</span>
                  <div className="flex-1 relative">
                    {/* Stacked bars for component profits only */}
                    <div className="flex gap-0.5">
                      {componentProfits.map(metric => {
                        const value = metric.y[originalIdx] || 0
                        const isNegative = value < 0
                        const absValue = Math.abs(value)
                        const percentage = maxTotal > 0 ? (absValue / maxTotal) * 100 : 0
                        const totalAbs = Math.abs(totalValue)
                        const percentOfTotal = totalAbs > 0 ? (absValue / totalAbs) * 100 : 0

                        if (percentage < 0.5) return null // Skip very small values

                        return (
                          <div
                            key={metric.id}
                            className={`h-4 ${getMetricColor(metric.id, isNegative)} transition-all`}
                            style={{ width: `${percentage}%` }}
                            title={`${metric.label}: ${isNegative ? '-' : ''}${formatBillion(absValue)} nghìn tỷ (${percentOfTotal.toFixed(1)}%)`}
                          ></div>
                        )
                      })}
                    </div>
                  </div>
                  <span className="text-xs font-semibold w-20 text-right text-white">
                    {formatBillion(Math.abs(totalValue))}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Trend line for LN trước thuế */}
          {profitBeforeTax && (
            <svg
              className="absolute top-0 h-full pointer-events-none"
              style={{ left: '4rem', width: 'calc(100% - 4rem - 5.5rem)' }}
            >
              {/* Draw connecting lines */}
              {[...profitBeforeTax.y].reverse().map((value, qIdx) => {
                if (qIdx === profitBeforeTax.y.length - 1) return null

                const originalIdx = data.x.length - 1 - qIdx
                const nextOriginalIdx = data.x.length - 2 - qIdx
                const currentValue = profitBeforeTax.y[originalIdx] || 0
                const nextValue = profitBeforeTax.y[nextOriginalIdx] || 0

                const y1 = qIdx * 20 + 8 // Center of row (20px height + 8px center)
                const y2 = (qIdx + 1) * 20 + 8

                const x1Percent = maxTotal > 0 ? (Math.abs(currentValue) / maxTotal) * 100 : 0
                const x2Percent = maxTotal > 0 ? (Math.abs(nextValue) / maxTotal) * 100 : 0

                return (
                  <line
                    key={`line-${qIdx}`}
                    x1={`${x1Percent}%`}
                    y1={y1}
                    x2={`${x2Percent}%`}
                    y2={y2}
                    stroke="#a855f7"
                    strokeWidth="2"
                  />
                )
              })}

              {/* Draw dots */}
              {[...profitBeforeTax.y].reverse().map((value, qIdx) => {
                const originalIdx = data.x.length - 1 - qIdx
                const currentValue = profitBeforeTax.y[originalIdx] || 0
                const absValue = Math.abs(currentValue)
                const xPercent = maxTotal > 0 ? (absValue / maxTotal) * 100 : 0
                const y = qIdx * 20 + 8 // Center of row

                return (
                  <g key={`dot-${qIdx}`}>
                    <circle
                      cx={`${xPercent}%`}
                      cy={y}
                      r="5"
                      fill="#a855f7"
                      stroke="#e9d5ff"
                      strokeWidth="2"
                    >
                      <title>
                        {profitBeforeTax.label}: {formatBillion(absValue)} nghìn tỷ
                      </title>
                    </circle>
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Equity Structure Chart */}
      {equityData && equityData.data && equityData.data.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 mt-4">
          {/* Section Title */}
          <h4 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
            🏛️ Cơ cấu Vốn chủ sở hữu
          </h4>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b border-gray-700/50">
            {equityData.data.map(metric => {
              const equityColor = getEquityMetricColor(metric.id)
              return (
                <div key={metric.id} className="flex items-center gap-2">
                  <div className={`w-3 h-3 ${equityColor}`}></div>
                  <span className="text-xs text-gray-300">{metric.label}</span>
                </div>
              )
            })}
          </div>

          {/* Header row */}
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700/50">
            <span className="text-xs text-gray-400 w-16 font-medium">Quý</span>
            <div className="flex-1"></div>
            <span className="text-xs text-gray-400 w-20 text-right font-medium">Nghìn tỷ</span>
          </div>

          {/* Stacked bar chart for equity */}
          <div className="space-y-1">
            {[...equityData.x].reverse().map((quarter, qIdx) => {
              const originalIdx = equityData.x.length - 1 - qIdx

              // Calculate total equity for this quarter
              const quarterTotal = equityData.data.reduce((sum, metric) => {
                return sum + Math.abs(metric.y[originalIdx] || 0)
              }, 0)

              // Find max total across all quarters for scaling
              const maxEquityTotal = Math.max(
                ...equityData.x.map((_, idx) => {
                  return equityData.data.reduce((sum, metric) => {
                    return sum + Math.abs(metric.y[idx] || 0)
                  }, 0)
                })
              )

              return (
                <div key={qIdx} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-16">{quarter}</span>
                  <div className="flex-1 flex gap-0.5">
                    {equityData.data.map(metric => {
                      const value = metric.y[originalIdx] || 0
                      const isNegative = value < 0
                      const absValue = Math.abs(value)
                      const percentage = maxEquityTotal > 0 ? (absValue / maxEquityTotal) * 100 : 0
                      const percentOfTotal = quarterTotal > 0 ? (absValue / quarterTotal) * 100 : 0

                      if (percentage < 0.5) return null // Skip very small values

                      return (
                        <div
                          key={metric.id}
                          className={`h-4 ${getEquityMetricColor(metric.id, isNegative)} transition-all`}
                          style={{ width: `${percentage}%` }}
                          title={`${metric.label}: ${isNegative ? '-' : ''}${formatBillion(absValue)} nghìn tỷ (${percentOfTotal.toFixed(1)}%)`}
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
      )}
    </div>
  )
}
