'use client'
import { useEffect, useState } from 'react'

interface CurrencyRate {
  code: string
  codeName: string
  closePrice: number
  openPrice: number
  highPrice: number
  lowPrice: number
  change: number
  changePct: number
  tradingDate: string
}

export default function ExchangeRateWidget() {
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchData = async () => {
    try {
      const currencies = ['USD_VND', 'EUR_VND', 'JPY_VND', 'GBP_VND', 'AUD_VND', 'CNY_VND', 'SGD_VND', 'THB_VND']
      const fetchPromises = currencies.map(code =>
        fetch(`https://api-finfo.vndirect.com.vn/v4/currencies/latest?order=tradingDate&where=locale:VN&filter=code:${code}`)
          .then(res => res.json())
      )
      
      const results = await Promise.all(fetchPromises)
      const mappedData: CurrencyRate[] = results
        .filter(data => data.data && data.data.length > 0)
        .map(data => data.data[0])
      
      setRates(mappedData)
      setLastUpdate(new Date().toLocaleTimeString('vi-VN'))
      setError(null)
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
    <div className="space-y-4">
      {lastUpdate && (
        <div className="text-xs text-muted text-right">
          Cập nhật lúc: {lastUpdate}
        </div>
      )}
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
                <th className="text-right p-3 font-semibold">Giá hiện tại</th>
                <th className="text-right p-3">Cao</th>
                <th className="text-right p-3">Thấp</th>
                <th className="text-right p-3 font-semibold">Thay đổi</th>
                <th className="text-right p-3 font-semibold">% Thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rates.map((rate) => {
                const currencyCode = rate.code.replace('_VND', '')
                
                return (
                  <tr key={rate.code} className="hover:bg-gray-900 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getCurrencyFlag(rate.code)}</span>
                        <div>
                          <div className="font-semibold">{currencyCode}</div>
                          <div className="text-xs text-muted">{rate.codeName.replace('Tỷ giá ', '')}</div>
                        </div>
                      </div>
                    </td>
                    <td className={'p-3 text-right ' + (rate.change > 0 ? 'text-green-500' : rate.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                      <div className="font-bold text-xl">{formatRate(rate.closePrice)}</div>
                      <div className="text-xs text-muted">VND</div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-medium text-sm">{formatRate(rate.highPrice)}</div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-medium text-sm">{formatRate(rate.lowPrice)}</div>
                    </td>
                    <td className={'p-3 text-right font-bold text-base ' + (rate.change > 0 ? 'text-green-500' : rate.change < 0 ? 'text-red-500' : 'text-yellow-500')}>
                      <div>{rate.change > 0 ? '▲ +' : rate.change < 0 ? '▼ ' : '● '}{formatRate(rate.change)}</div>
                    </td>
                    <td className={'p-3 text-right font-bold text-base ' + (rate.changePct > 0 ? 'text-green-500' : rate.changePct < 0 ? 'text-red-500' : 'text-yellow-500')}>
                      <div>{rate.changePct > 0 ? '+' : ''}{rate.changePct.toFixed(2)}%</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
