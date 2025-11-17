'use client'

import { useState, useEffect } from 'react'
import { fetchFinancialRatiosClient } from '@/services/vndirect-client'
import type { FinancialRatio } from '@/types/vndirect'
import { formatFinancialRatio } from '@/utils/formatters'

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

        const response = await fetchFinancialRatiosClient(symbol)

        const ratiosMap: Record<string, FinancialRatio> = {}
        response.data.forEach(ratio => {
          ratiosMap[ratio.ratioCode] = ratio
        })

        console.log('✅ Financial ratios loaded:', Object.keys(ratiosMap).length, 'ratios')
        setRatios(ratiosMap)
      } catch (err) {
        console.error('❌ Error loading financial ratios:', err)

        // Provide more specific error message
        let errorMessage = 'Không tải được chỉ số tài chính'
        if (err instanceof Error) {
          // Extract status code from error message if available
          const statusMatch = err.message.match(/error: (\d+)/)
          if (statusMatch) {
            const status = statusMatch[1]
            if (status === '404') {
              errorMessage = 'VNDirect không có dữ liệu tài chính cho mã này'
            } else if (status === '403') {
              errorMessage = 'Bị chặn truy cập API (403)'
            } else if (status === '500' || status === '502' || status === '503') {
              errorMessage = 'VNDirect API tạm thời không khả dụng'
            }
          }
          console.error('Error details:', err.message)
        }
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    loadRatios()
  }, [symbol])

  // Use standardized formatter from utils
  const formatValue = (ratioCode: string, value: number | undefined): string => {
    return formatFinancialRatio(ratioCode, value)
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
