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

    const loadRatios = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetchFinancialRatios(symbol)

        const ratiosMap: Record<string, FinancialRatio> = {}
        response.data.forEach(ratio => {
          ratiosMap[ratio.ratioCode] = ratio
        })

        setRatios(ratiosMap)
      } catch (err) {
        console.error('Error loading financial ratios:', err)
        setError('Không tải được chỉ số tài chính')
      } finally {
        setLoading(false)
      }
    }

    loadRatios()
  }, [symbol])

  const formatValue = (ratio: FinancialRatio | undefined): string => {
    if (!ratio) return 'N/A'

    const value = ratio.value

    if (ratio.unit === 'VND') {
      if (value >= 1000000000000) {
        return `${(value / 1000000000000).toFixed(2)} nghìn tỷ`
      } else if (value >= 1000000000) {
        return `${(value / 1000000000).toFixed(2)} tỷ`
      } else if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)} triệu`
      }
    }

    if (ratio.unit === '%') {
      return `${value.toFixed(2)}%`
    }

    return value.toFixed(2)
  }

  const financialMetrics = [
    { key: 'MARKETCAP', label: 'Vốn hóa thị trường', icon: '💰' },
    { key: 'PE', label: 'P/E (Giá/Thu nhập)', icon: '📊' },
    { key: 'PB', label: 'P/B (Giá/Sổ sách)', icon: '📖' },
    { key: 'PS', label: 'P/S (Giá/Doanh thu)', icon: '💵' },
    { key: 'EPS', label: 'EPS (Thu nhập/cổ phiếu)', icon: '💸' },
    { key: 'BVPS', label: 'BVPS (Giá trị sổ sách/cổ phiếu)', icon: '📚' },
    { key: 'ROAE', label: 'ROE (Lợi nhuận/Vốn CSH)', icon: '📈' },
    { key: 'ROAA', label: 'ROA (Lợi nhuận/Tổng tài sản)', icon: '🏦' },
    { key: 'BETA', label: 'Beta (Độ biến động)', icon: '📉' },
    { key: 'DIVIDEND', label: 'Tỷ suất cổ tức', icon: '💎' },
    { key: 'PAYOUTRATIO', label: 'Tỷ lệ chi trả cổ tức', icon: '🎁' },
    { key: 'EBITDA', label: 'EBITDA', icon: '💹' },
    { key: 'EVEBITDA', label: 'EV/EBITDA', icon: '🔢' },
    { key: 'DEBTEQUITY', label: 'Nợ/Vốn CSH', icon: '⚖️' },
    { key: 'CURRENTRATIO', label: 'Tỷ số thanh toán hiện hành', icon: '💧' },
    { key: 'QUICKRATIO', label: 'Tỷ số thanh toán nhanh', icon: '⚡' },
    { key: 'GROSSPROFITMARGIN', label: 'Biên lợi nhuận gộp', icon: '📊' },
    { key: 'NETPROFITMARGIN', label: 'Biên lợi nhuận ròng', icon: '💰' },
    { key: 'ASSETTURNOVER', label: 'Vòng quay tài sản', icon: '🔄' },
    { key: 'INVENTORYTURNOVER', label: 'Vòng quay hàng tồn kho', icon: '📦' },
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
          const value = formatValue(ratio)

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
              {ratio && ratio.unit && (
                <div className="text-xs text-gray-500 mt-1">
                  {ratio.unit}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
