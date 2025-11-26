'use client'

import { useEffect, useState, memo } from 'react'

interface VNIndexMetrics {
  vnid3d?: number
  vnid1m?: number
  vnid3m?: number
  vnid1y?: number
  vnipe?: number
  vnipb?: number
}

interface APIResponse {
  data?: VNIndexMetrics[]
}

const getChangeColor = (value: number | undefined): string => {
  if (!value) return 'text-gray-400'
  if (value > 0) return 'text-green-500'
  if (value < 0) return 'text-red-500'
  return 'text-yellow-500'
}

const getChangeIcon = (value: number | undefined): string => {
  if (!value) return '▬'
  if (value > 0) return '▲'
  if (value < 0) return '▼'
  return '▬'
}

const formatPercent = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

const formatValue = (value: number | undefined): string => {
  if (value === undefined || value === null) return 'N/A'
  return value.toFixed(2)
}

// Memoized metric card component
const MetricCard = memo(({
  title,
  value,
  isPercent = true
}: {
  title: string
  value: number | undefined
  isPercent?: boolean
}) => {
  const displayValue = isPercent ? formatPercent(value) : formatValue(value)
  const colorClass = isPercent ? getChangeColor(value) : 'text-white'
  const icon = isPercent ? getChangeIcon(value) : ''

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors duration-300 border border-gray-700">
      <div className="flex flex-col space-y-2">
        <span className="text-sm text-gray-400">{title}</span>
        <div className={`text-lg font-bold ${colorClass} transition-all duration-500 ease-out`}>
          {icon && <span className="mr-1">{icon}</span>}
          {displayValue}
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return prevProps.value === nextProps.value
})

MetricCard.displayName = 'MetricCard'

interface VNIndexEvaluationWidgetProps {
  isActive?: boolean
}

export default function VNIndexEvaluationWidget({ isActive = true }: VNIndexEvaluationWidgetProps) {
  const [metrics, setMetrics] = useState<VNIndexMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const fetchMetrics = async () => {
    try {
      const response = await fetch(
        'https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/second-tc-price?tickers=HPG'
      )
      if (!response.ok) throw new Error('Failed to fetch data')

      const data: APIResponse = await response.json()

      // Get the first item from data array
      if (data.data && data.data.length > 0) {
        setMetrics(data.data[0])
      }
      setError(null)
    } catch (err) {
      console.error('Error fetching VNINDEX metrics:', err)
      // Only show error if we have no data yet
      if (!metrics) {
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
      fetchMetrics()
      // Auto refresh every 30 seconds only when tab is active
      const interval = setInterval(fetchMetrics, 30000)
      return () => clearInterval(interval)
    }
  }, [mounted, isActive])

  // Only show loading skeleton on initial load
  if (!mounted || (loading && !metrics)) {
    return (
      <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800 w-full max-w-full">
        <div className="animate-pulse space-y-3 sm:space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show error only if we have no data
  if (error && !metrics) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-red-800">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800 transition-all duration-300 w-full max-w-full overflow-hidden">
      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 text-white">
        📈 Đánh giá VNINDEX
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 md:gap-4">
        <MetricCard
          title="3 ngày"
          value={metrics?.vnid3d}
        />
        <MetricCard
          title="1 tháng"
          value={metrics?.vnid1m}
        />
        <MetricCard
          title="3 tháng"
          value={metrics?.vnid3m}
        />
        <MetricCard
          title="1 năm"
          value={metrics?.vnid1y}
        />
        <MetricCard
          title="P/E"
          value={metrics?.vnipe}
          isPercent={false}
        />
        <MetricCard
          title="P/B"
          value={metrics?.vnipb}
          isPercent={false}
        />
      </div>

      {!metrics && (
        <div className="text-center text-gray-400 py-6 sm:py-8">
          Không có dữ liệu đánh giá
        </div>
      )}
    </div>
  )
}
