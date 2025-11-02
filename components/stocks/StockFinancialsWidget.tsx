'use client'
import { useEffect, useState } from 'react'

interface FinancialRatio {
  ratioCode: string
  ratioName: string
  value: number
  unit: string
}

export default function StockFinancialsWidget({ stockCode }: { stockCode: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ratios, setRatios] = useState<FinancialRatio[]>([])

  const ratioList = [
    'MARKETCAP',
    'P/E',
    'P/B',
    'ROAE',
    'ROAA',
    'BETA',
    'EPS',
    'BVPS',
    'DIVIDEND',
    'YIELD',
    'EVONEBITDA',
    'DEBT/EQUITY',
    'CURRENT',
    'QUICK',
    'INTERESTCOVERAGE',
  ]

  const getRatioDisplayName = (code: string): string => {
    const names: Record<string, string> = {
      MARKETCAP: 'Vốn hóa thị trường',
      'P/E': 'P/E - Giá trên Thu nhập',
      'P/B': 'P/B - Giá trên Giá trị sổ sách',
      ROAE: 'ROAE - Lợi nhuận trên Vốn chủ sở hữu',
      ROAA: 'ROAA - Lợi nhuận trên Tổng tài sản',
      BETA: 'Beta - Hệ số biến động',
      EPS: 'EPS - Thu nhập trên mỗi cổ phiếu',
      BVPS: 'BVPS - Giá trị sổ sách/Cổ phiếu',
      DIVIDEND: 'Cổ tức',
      YIELD: 'Tỷ suất cổ tức',
      EVONEBITDA: 'EV/EBITDA',
      'DEBT/EQUITY': 'Nợ/Vốn chủ sở hữu',
      CURRENT: 'Khả năng thanh toán hiện hành',
      QUICK: 'Khả năng thanh toán nhanh',
      INTERESTCOVERAGE: 'Khả năng thanh toán lãi vay',
    }
    return names[code] || code
  }

  const getUnit = (code: string): string => {
    if (code === 'MARKETCAP') return 'tỷ VNĐ'
    if (code === 'YIELD' || code === 'ROAE' || code === 'ROAA') return '%'
    if (code === 'EPS' || code === 'BVPS' || code === 'DIVIDEND') return 'VNĐ'
    return 'lần'
  }

  const fetchFinancialRatios = async () => {
    try {
      setLoading(true)
      const filter = ratioList.join(',')
      const response = await fetch(
        `https://api-finfo.vndirect.com.vn/v4/ratios/latest?filter=ratioCode:${filter}&where=code:${stockCode}`
      )

      if (!response.ok) throw new Error('Không thể tải dữ liệu')

      const data = await response.json()

      if (data.data && Array.isArray(data.data)) {
        const mappedRatios: FinancialRatio[] = data.data.map((item: any) => ({
          ratioCode: item.ratioCode,
          ratioName: getRatioDisplayName(item.ratioCode),
          value: item.value || 0,
          unit: getUnit(item.ratioCode),
        }))

        setRatios(mappedRatios)
        setError(null)
      } else {
        setError('Không tìm thấy dữ liệu chỉ số tài chính')
      }
    } catch (err) {
      setError('Không thể tải dữ liệu chỉ số tài chính')
      console.error('Error fetching financial ratios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFinancialRatios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockCode])

  const formatValue = (value: number, unit: string): string => {
    if (unit === 'tỷ VNĐ') {
      return (value / 1000000000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })
    }
    if (unit === '%') {
      return value.toFixed(2)
    }
    if (unit === 'VNĐ') {
      return value.toLocaleString('vi-VN', { maximumFractionDigits: 0 })
    }
    return value.toFixed(2)
  }

  const getValueColor = (code: string, value: number): string => {
    if (code === 'P/E' || code === 'P/B') {
      if (value < 10) return 'text-green-500'
      if (value < 20) return 'text-yellow-500'
      return 'text-red-500'
    }
    if (code === 'ROAE' || code === 'ROAA') {
      if (value > 15) return 'text-green-500'
      if (value > 10) return 'text-yellow-500'
      return 'text-red-500'
    }
    if (code === 'YIELD') {
      if (value > 5) return 'text-green-500'
      if (value > 3) return 'text-yellow-500'
      return 'text-red-500'
    }
    return 'text-white'
  }

  if (loading) {
    return (
      <div className="bg-panel border border-gray-800 rounded-lg p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-panel border border-gray-800 rounded-lg p-8">
        <div className="text-center py-8 text-red-400">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-gray-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-xl font-bold">Chỉ số Tài chính</h3>
        <p className="text-sm text-muted mt-1">Các chỉ số cơ bản và quan trọng nhất</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900 text-sm">
            <tr>
              <th className="text-left p-3">Chỉ số</th>
              <th className="text-right p-3 font-semibold">Giá trị</th>
              <th className="text-left p-3">Đơn vị</th>
              <th className="text-left p-3">Đánh giá</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {ratios.map((ratio) => (
              <tr key={ratio.ratioCode} className="hover:bg-gray-900 transition-colors">
                <td className="p-3">
                  <div className="font-semibold text-base">{ratio.ratioName}</div>
                  <div className="text-xs text-muted">{ratio.ratioCode}</div>
                </td>
                <td className={`p-3 text-right font-bold text-xl ${getValueColor(ratio.ratioCode, ratio.value)}`}>
                  {formatValue(ratio.value, ratio.unit)}
                </td>
                <td className="p-3 text-sm text-muted">{ratio.unit}</td>
                <td className="p-3 text-sm">
                  {ratio.ratioCode === 'P/E' && (
                    <span className="text-xs text-muted">
                      {ratio.value < 10 ? '✓ Hấp dẫn' : ratio.value < 20 ? '○ Trung bình' : '✗ Cao'}
                    </span>
                  )}
                  {ratio.ratioCode === 'ROAE' && (
                    <span className="text-xs text-muted">
                      {ratio.value > 15 ? '✓ Tốt' : ratio.value > 10 ? '○ Khá' : '✗ Yếu'}
                    </span>
                  )}
                  {ratio.ratioCode === 'YIELD' && (
                    <span className="text-xs text-muted">
                      {ratio.value > 5 ? '✓ Cao' : ratio.value > 3 ? '○ Trung bình' : '✗ Thấp'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-800 bg-gray-900">
        <div className="text-xs text-muted">
          <div className="font-semibold mb-2">Ghi chú:</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-green-500">●</span>
              <span>Xanh: Chỉ số tốt, đáng đầu tư</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">●</span>
              <span>Vàng: Chỉ số trung bình</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">●</span>
              <span>Đỏ: Chỉ số cần cân nhắc</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
