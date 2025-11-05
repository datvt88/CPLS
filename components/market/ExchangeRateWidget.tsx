'use client'

import { useEffect, useState } from 'react'
import type { ExchangeRateData, VNDirectResponse } from '@/types/market'

const currencyInfo: Record<string, { name: string; flag: string }> = {
  'USD_VND': { name: 'Đô la Mỹ', flag: '🇺🇸' },
  'EUR_VND': { name: 'Euro', flag: '🇪🇺' },
  'JPY_VND': { name: 'Yên Nhật', flag: '🇯🇵' },
  'GBP_VND': { name: 'Bảng Anh', flag: '🇬🇧' },
  'AUD_VND': { name: 'Đô la Úc', flag: '🇦🇺' },
  'CNY_VND': { name: 'Nhân dân tệ', flag: '🇨🇳' },
  'SGD_VND': { name: 'Đô la Singapore', flag: '🇸🇬' },
  'THB_VND': { name: 'Bạt Thái', flag: '🇹🇭' },
}

const formatVND = (value: number): string => {
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export default function ExchangeRateWidget() {
  const [rates, setRates] = useState<ExchangeRateData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/market/exchange-rates')
      if (!response.ok) throw new Error('Failed to fetch exchange rates')

      const data: VNDirectResponse<ExchangeRateData> = await response.json()
      setRates(data.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching exchange rates:', err)
      setError('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExchangeRates()
    const interval = setInterval(fetchExchangeRates, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-red-700">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl">
      <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        💱 Tỷ giá ngoại tệ
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
        <span className="text-sm font-normal text-gray-400 ml-2">vs VND 🇻🇳</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rates.map((rate) => {
          const info = currencyInfo[rate.code]
          if (!info) return null

          const spread = rate.sellRate - rate.buyRate
          const spreadPercent = (spread / rate.buyRate) * 100

          return (
            <div
              key={rate.code}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{info.flag}</span>
                <div>
                  <div className="font-semibold text-white text-lg">{info.name}</div>
                  <div className="text-xs text-gray-400">{rate.code.replace('_VND', '')}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                  <div className="text-xs text-green-400 mb-1">Mua vào</div>
                  <div className="text-lg font-bold text-green-500">
                    {formatVND(rate.buyRate)}
                  </div>
                </div>

                <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
                  <div className="text-xs text-red-400 mb-1">Bán ra</div>
                  <div className="text-lg font-bold text-red-500">
                    {formatVND(rate.sellRate)}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between text-xs">
                <div className="text-gray-400">
                  Chênh lệch: <span className="text-yellow-400 font-semibold">{formatVND(spread)}</span>
                </div>
                <div className="text-gray-400">
                  ({spreadPercent.toFixed(2)}%)
                </div>
              </div>

              {rate.midRate && (
                <div className="mt-2 text-xs text-gray-400 text-center">
                  Giá trung bình: <span className="text-gray-300 font-semibold">{formatVND(rate.midRate)}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {rates.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Không có dữ liệu tỷ giá
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-right">
        Cập nhật: {new Date().toLocaleTimeString('vi-VN')}
      </div>
    </div>
  )
}
