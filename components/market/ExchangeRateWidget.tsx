'use client'
import { useEffect, useState } from 'react'
import { ExchangeRate } from '@/types'

export default function ExchangeRateWidget() {
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/currencies/latest?order=tradingDate&where=locale:VN&filter=code:USD_VND,EUR_VND,JPY_VND,GBP_VND,AUD_VND,CNY_VND,SGD_VND,THB_VND'
      )
      const data = await response.json()
      
      if (data.data) {
        const mappedData: ExchangeRate[] = data.data.map((item: any) => ({
          code: item.code,
          name: getCurrencyName(item.code),
          buyRate: item.buy || item.buyRate || 0,
          sellRate: item.sell || item.sellRate || 0,
          change: item.change || 0,
          changePercent: item.pctChange || 0,
        }))
        setRates(mappedData)
        setError(null)
      }
    } catch (err) {
      setError('Không thể tải dữ liệu')
      console.error('Error fetching exchange rates:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const getCurrencyName = (code: string) => {
    const names: Record<string, string> = {
      USD_VND: 'Đô la Mỹ',
      EUR_VND: 'Euro',
      JPY_VND: 'Yên Nhật',
      GBP_VND: 'Bảng Anh',
      AUD_VND: 'Đô la Úc',
      CNY_VND: 'Nhân dân tệ',
      SGD_VND: 'Đô la Singapore',
      THB_VND: 'Baht Thái',
    }
    return names[code] || code
  }

  const getCurrencyFlag = (code: string) => {
    const flags: Record<string, string> = {
      USD_VND: '🇺🇸',
      EUR_VND: '🇪🇺',
      JPY_VND: '🇯🇵',
      GBP_VND: '🇬🇧',
      AUD_VND: '🇦🇺',
      CNY_VND: '🇨🇳',
      SGD_VND: '🇸🇬',
      THB_VND: '🇹🇭',
    }
    return flags[code] || '💱'
  }

  const formatRate = (rate: number) => {
    return new Intl.NumberFormat('vi-VN').format(rate)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-8 text-red-400"><p>{error}</p></div>
  }

  return (
    <div className="bg-panel border border-gray-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="font-semibold text-lg">Tỷ giá ngoại tệ</h3>
        <p className="text-sm text-muted">So với VND</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900 text-sm">
            <tr>
              <th className="text-left p-3">Tiền tệ</th>
              <th className="text-right p-3">Mua vào</th>
              <th className="text-right p-3">Bán ra</th>
              <th className="text-right p-3">Chênh lệch</th>
              <th className="text-right p-3">Thay đổi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rates.map((rate) => {
              const spread = rate.sellRate - rate.buyRate
              const spreadPercent = ((spread / rate.buyRate) * 100).toFixed(2)
              
              return (
                <tr key={rate.code} className="hover:bg-gray-900 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getCurrencyFlag(rate.code)}</span>
                      <div>
                        <div className="font-semibold">{rate.code.replace('_VND', '')}</div>
                        <div className="text-xs text-muted">{rate.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-medium text-green-500">{formatRate(rate.buyRate)}</div>
                    <div className="text-xs text-muted">VND</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-medium text-red-500">{formatRate(rate.sellRate)}</div>
                    <div className="text-xs text-muted">VND</div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-medium">{formatRate(spread)}</div>
                    <div className="text-xs text-muted">{spreadPercent}%</div>
                  </td>
                  <td className={'p-3 text-right font-semibold ' + (rate.change && rate.change > 0 ? 'text-green-500' : rate.change && rate.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                    {rate.change ? (
                      <>
                        <div>{rate.change > 0 ? '+' : ''}{rate.change.toFixed(0)}</div>
                        <div className="text-xs">{rate.changePercent && rate.changePercent > 0 ? '+' : ''}{rate.changePercent?.toFixed(2) || '0.00'}%</div>
                      </>
                    ) : (
                      <div className="text-muted">-</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
