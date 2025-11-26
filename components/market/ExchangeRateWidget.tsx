'use client'

import { useEffect, useState, memo } from 'react'
import type { ExchangeRateData, VNDirectResponse } from '@/types/market'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange'

const currencyInfo: Record<string, { name: string; flag: string; isVND: boolean }> = {
  'USD_VND': { name: 'Đô la Mỹ', flag: '🇺🇸', isVND: true },
  'EUR_VND': { name: 'Euro', flag: '🇪🇺', isVND: true },
  'JPY_VND': { name: 'Yên Nhật', flag: '🇯🇵', isVND: true },
  'CNY_VND': { name: 'Nhân dân tệ', flag: '🇨🇳', isVND: true },
  'EUR_USD': { name: 'EUR/USD', flag: '🇪🇺🇺🇸', isVND: false },
  'USD_JPY': { name: 'USD/JPY', flag: '🇺🇸🇯🇵', isVND: false },
  'USD_CNY': { name: 'USD/CNY', flag: '🇺🇸🇨🇳', isVND: false },
}

const formatValue = (value: number, currencyCode?: string): string => {
  // For JPY pairs (smaller decimal values)
  if (currencyCode?.includes('JPY')) {
    return value.toLocaleString('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  // For non-VND pairs (like EUR_USD, USD_CNY)
  if (currencyCode && !currencyCode.includes('VND')) {
    return value.toLocaleString('vi-VN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  }

  // For VND pairs (whole numbers)
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

// Memoized currency card component
const CurrencyCard = memo(({ rate, info }: { rate: ExchangeRateData; info: { name: string; flag: string; isVND: boolean } }) => {
  const isPositive = rate.change > 0
  const isNegative = rate.change < 0
  const changeColor = isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-400'
  const changeBg = isPositive ? 'bg-green-900/20 border-green-700/30' : isNegative ? 'bg-red-900/20 border-red-700/30' : 'bg-gray-800/50 border-gray-700'

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors duration-300 border border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{info.flag}</span>
        <div className="flex-1">
          <div className="font-semibold text-white text-lg">{info.name}</div>
          <div className="text-xs text-gray-400">{rate.code}</div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-semibold transition-all duration-500 ease-out ${changeColor}`}>
            {isPositive ? '↑' : isNegative ? '↓' : '•'} {rate.changePct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-1">Giá hiện tại</div>
        <div className="text-2xl font-bold text-white transition-all duration-500 ease-out">
          {formatValue(rate.closePrice, rate.code)}
        </div>
      </div>

      <div className={`rounded-lg p-3 border ${changeBg}`}>
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-400 mb-1">Thay đổi</div>
            <div className={`text-lg font-bold transition-all duration-500 ease-out ${changeColor}`}>
              {isPositive ? '+' : ''}{formatValue(rate.change, rate.code)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 mb-1">Giá mở cửa</div>
            <div className="text-sm font-semibold text-gray-300 transition-all duration-500 ease-out">
              {formatValue(rate.openPrice, rate.code)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-900/50 rounded p-2">
          <div className="text-gray-400 mb-1">Cao nhất</div>
          <div className="text-green-400 font-semibold">{formatValue(rate.highPrice, rate.code)}</div>
        </div>
        <div className="bg-gray-900/50 rounded p-2">
          <div className="text-gray-400 mb-1">Thấp nhất</div>
          <div className="text-red-400 font-semibold">{formatValue(rate.lowPrice, rate.code)}</div>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        Ngày: {rate.tradingDate}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if data actually changed
  return (
    prevProps.rate.closePrice === nextProps.rate.closePrice &&
    prevProps.rate.change === nextProps.rate.change &&
    prevProps.rate.changePct === nextProps.rate.changePct &&
    prevProps.rate.openPrice === nextProps.rate.openPrice &&
    prevProps.rate.highPrice === nextProps.rate.highPrice &&
    prevProps.rate.lowPrice === nextProps.rate.lowPrice
  )
})

CurrencyCard.displayName = 'CurrencyCard'

interface ExchangeRateWidgetProps {
  isActive?: boolean
}

export default function ExchangeRateWidget({ isActive = true }: ExchangeRateWidgetProps) {
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
      // Only show error if we have no data yet
      if (rates.length === 0) {
        setError('Không thể tải dữ liệu')
      }
      // Keep old data if update fails
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isActive) {
      fetchExchangeRates()
      // Auto refresh every 3 seconds only when tab is active
      const interval = setInterval(fetchExchangeRates, 3000)
      return () => clearInterval(interval)
    }
  }, [mounted, isActive])

  // Only show loading skeleton on initial load
  if (!mounted || (loading && rates.length === 0)) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-64 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show error only if we have no data
  if (error && rates.length === 0) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-red-800">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  // Separate VND and non-VND pairs
  const vndPairs = rates.filter(r => currencyInfo[r.code]?.isVND)
  const otherPairs = rates.filter(r => !currencyInfo[r.code]?.isVND)

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 transition-all duration-300">
      <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        <CurrencyExchangeIcon sx={{ fontSize: 28 }} />
        Tỷ giá ngoại tệ
        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </h3>

      {/* VND Pairs */}
      {vndPairs.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            🇻🇳 So với VND
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vndPairs.map((rate) => {
              const info = currencyInfo[rate.code]
              if (!info) return null

              return (
                <CurrencyCard
                  key={rate.code}
                  rate={rate}
                  info={info}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Other Currency Pairs */}
      {otherPairs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            🌍 Tỷ giá quốc tế
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherPairs.map((rate) => {
              const info = currencyInfo[rate.code]
              if (!info) return null

              return (
                <CurrencyCard
                  key={rate.code}
                  rate={rate}
                  info={info}
                />
              )
            })}
          </div>
        </div>
      )}

      {rates.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Không có dữ liệu tỷ giá
        </div>
      )}

    </div>
  )
}
