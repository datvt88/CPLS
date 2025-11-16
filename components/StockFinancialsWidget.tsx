'use client'

import { useState, useEffect } from 'react'
import { fetchFinancialRatios } from '@/services/vndirect'
import type { FinancialRatio } from '@/types/vndirect'

interface StockFinancialsWidgetProps {
  symbol: string
}

export default function StockFinancialsWidget({ symbol }: StockFinancialsWidgetProps) {
  const [ratios, setRatios] = useState<Record<string, FinancialRatio>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Reset state when symbol changes
    setRatios({})

    const loadRatios = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('📊 Loading financial ratios for:', symbol)

        const response = await fetchFinancialRatios(symbol)

        const ratiosMap: Record<string, FinancialRatio> = {}
        response.data.forEach(ratio => {
          ratiosMap[ratio.ratioCode] = ratio
        })

        console.log('✅ Financial ratios loaded:', Object.keys(ratiosMap).length, 'ratios')
        setRatios(ratiosMap)
      } catch (err) {
        console.error('❌ Error loading financial ratios:', err)
        setError('Không tải được chỉ số tài chính')
      } finally {
        setLoading(false)
      }
    }

    loadRatios()
  }, [symbol])

  const formatValue = (ratioCode: string, value: number | undefined): string => {
    if (value === undefined || value === null) return 'N/A'

    // Format based on ratio type
    switch (ratioCode) {
      case 'MARKETCAP':
        // Market cap in VND
        if (value >= 1000000000000) {
          return `${(value / 1000000000000).toFixed(2)} nghìn tỷ`
        } else if (value >= 1000000000) {
          return `${(value / 1000000000).toFixed(2)} tỷ`
        }
        return `${value.toFixed(2)}`

      case 'NMVOLUME_AVG_CR_10D':
        // Volume - show in millions
        if (value >= 1000000) {
          return `${(value / 1000000).toFixed(2)}M`
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(2)}K`
        }
        return `${value.toFixed(0)}`

      case 'PRICE_HIGHEST_CR_52W':
      case 'PRICE_LOWEST_CR_52W':
      case 'BVPS_CR':
        // Prices in VND
        return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}`

      case 'OUTSTANDING_SHARES':
        // Shares - show in billions/millions
        if (value >= 1000000000) {
          return `${(value / 1000000000).toFixed(2)} tỷ CP`
        } else if (value >= 1000000) {
          return `${(value / 1000000).toFixed(2)} triệu CP`
        }
        return `${value.toFixed(0)}`

      case 'FREEFLOAT':
      case 'DIVIDEND_YIELD':
      case 'ROAE_TR_AVG5Q':
      case 'ROAA_TR_AVG5Q':
        // Percentages
        return `${(value * 100).toFixed(2)}%`

      case 'EPS_TR':
        // EPS in VND
        return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}`

      case 'BETA':
      case 'PRICE_TO_EARNINGS':
      case 'PRICE_TO_BOOK':
        // Ratios - 2 decimal places
        return `${value.toFixed(2)}`

      default:
        return `${value.toFixed(2)}`
    }
  }

  const financialMetrics = [
    { key: 'MARKETCAP', label: 'Vốn hóa thị trường', icon: '💰' },
    { key: 'PRICE_TO_EARNINGS', label: 'P/E (Giá/Thu nhập)', icon: '📊' },
    { key: 'PRICE_TO_BOOK', label: 'P/B (Giá/Sổ sách)', icon: '📖' },
    { key: 'EPS_TR', label: 'EPS (Thu nhập/CP)', icon: '💵' },
    { key: 'BVPS_CR', label: 'BVPS (Giá trị sổ sách/CP)', icon: '📚' },
    { key: 'ROAE_TR_AVG5Q', label: 'ROE TB 5 quý', icon: '📈' },
    { key: 'ROAA_TR_AVG5Q', label: 'ROA TB 5 quý', icon: '🏦' },
    { key: 'BETA', label: 'Beta (Độ biến động)', icon: '📉' },
    { key: 'DIVIDEND_YIELD', label: 'Tỷ suất cổ tức', icon: '💎' },
    { key: 'OUTSTANDING_SHARES', label: 'Số lượng CP lưu hành', icon: '📊' },
    { key: 'FREEFLOAT', label: 'Tỷ lệ Free Float', icon: '🔓' },
    { key: 'NMVOLUME_AVG_CR_10D', label: 'KL TB 10 ngày', icon: '📊' },
    { key: 'PRICE_HIGHEST_CR_52W', label: 'Giá cao nhất 52 tuần', icon: '⬆️' },
    { key: 'PRICE_LOWEST_CR_52W', label: 'Giá thấp nhất 52 tuần', icon: '⬇️' },
  ]

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải chỉ số tài chính...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        📊 Chỉ số Tài chính - {symbol}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {financialMetrics.map(metric => {
          const ratio = ratios[metric.key]
          const value = formatValue(metric.key, ratio?.value)

          return (
            <div
              key={metric.key}
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{metric.icon}</span>
                <span className="text-gray-400 text-sm">{metric.label}</span>
              </div>
              <div className="text-xl font-bold text-white">
                {value}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
