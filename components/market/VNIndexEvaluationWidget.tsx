'use client'

import { useEffect, useState, memo } from 'react'

interface RatioData {
  code: string
  group: string
  reportDate: string
  itemCode: string
  ratioCode: string
  itemName: string
  value: number
}

interface VNIndexMetrics {
  pe?: number      // P/E (81007)
  pb?: number      // P/B (81013)
  ps?: number      // P/S (81017)
  roaa?: number    // ROAA (82006)
  roae?: number    // ROAE (82008)
  dividendYield?: number  // Dividend Yield (81002)
}

interface APIResponse {
  data?: RatioData[]
}

const formatValue = (value: number | undefined, isPercent: boolean = false): string => {
  if (value === undefined || value === null) return 'N/A'

  if (isPercent) {
    // Convert decimal to percentage (e.g., 0.02 -> 2%)
    return `${(value * 100).toFixed(2)}%`
  }

  return value.toFixed(2)
}

// Memoized metric card component
const MetricCard = memo(({
  title,
  value,
  isPercent = false
}: {
  title: string
  value: number | undefined
  isPercent?: boolean
}) => {
  const displayValue = formatValue(value, isPercent)

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors duration-300 border border-gray-700">
      <div className="flex flex-col space-y-2">
        <span className="text-sm text-gray-400">{title}</span>
        <div className="text-lg font-bold text-white transition-all duration-500 ease-out">
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
        'https://api-finfo.vndirect.com.vn/v4/ratios/latest?order=reportDate&where=code:VNINDEX&filter=itemCode:81007,81008,81013,81014,81016,81017,82005,82006,82007,82008,81001,81002,81004,81005'
      )
      if (!response.ok) throw new Error('Failed to fetch data')

      const apiData: APIResponse = await response.json()

      // Parse array data into object
      if (apiData.data && apiData.data.length > 0) {
        const metricsData: VNIndexMetrics = {}

        apiData.data.forEach((item: RatioData) => {
          switch (item.itemCode) {
            case '81007': // P/E
              metricsData.pe = item.value
              break
            case '81013': // P/B
              metricsData.pb = item.value
              break
            case '81017': // P/S
              metricsData.ps = item.value
              break
            case '82006': // ROAA
              metricsData.roaa = item.value
              break
            case '82008': // ROAE
              metricsData.roae = item.value
              break
            case '81002': // Dividend Yield
              metricsData.dividendYield = item.value
              break
          }
        })

        setMetrics(metricsData)
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
          title="P/E"
          value={metrics?.pe}
          isPercent={false}
        />
        <MetricCard
          title="P/B"
          value={metrics?.pb}
          isPercent={false}
        />
        <MetricCard
          title="P/S"
          value={metrics?.ps}
          isPercent={false}
        />
        <MetricCard
          title="ROAA"
          value={metrics?.roaa}
          isPercent={true}
        />
        <MetricCard
          title="ROAE"
          value={metrics?.roae}
          isPercent={true}
        />
        <MetricCard
          title="Cổ tức"
          value={metrics?.dividendYield}
          isPercent={true}
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
