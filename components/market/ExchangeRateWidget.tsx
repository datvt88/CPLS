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
  const [mounted, setMounted] = useState(false)

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
    setMounted(true)
    fetchExchangeRates()
    const interval = setInterval(fetchExchangeRates, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [])

  // Don't render anything until mounted on client
  if (!mounted) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
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

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
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
      <div className="bg-[--panel] rounded-xl p-6 border border-red-800">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
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

          const isPositive = rate.change > 0
          const isNegative = rate.change < 0
          const changeColor = isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-400'
          const changeBg = isPositive ? 'bg-green-900/20 border-green-700/30' : isNegative ? 'bg-red-900/20 border-red-700/30' : 'bg-gray-800/50 border-gray-700'

          return (
            <div
              key={rate.code}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{info.flag}</span>
                <div className="flex-1">
                  <div className="font-semibold text-white text-lg">{info.name}</div>
                  <div className="text-xs text-gray-400">{rate.code.replace('_VND', '')}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-semibold ${changeColor}`}>
                    {isPositive ? '↑' : isNegative ? '↓' : '•'} {rate.changePct.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1">Giá hiện tại</div>
                <div className="text-2xl font-bold text-white">
                  {formatVND(rate.price)}
                </div>
              </div>

              <div className={`rounded-lg p-3 border ${changeBg}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Thay đổi</div>
                    <div className={`text-lg font-bold ${changeColor}`}>
                      {isPositive ? '+' : ''}{formatVND(rate.change)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 mb-1">Giá đầu kỳ</div>
                    <div className="text-sm font-semibold text-gray-300">
                      {formatVND(rate.bopPrice)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-500 text-center">
                Cập nhật: {rate.lastUpdated}
              </div>
            </div>
          )
        })}
      </div>

      {rates.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Không có dữ liệu tỷ giá
        </div>
      )}

    </div>
  )
}
