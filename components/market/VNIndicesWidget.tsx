'use client'

import { useEffect, useState, memo } from 'react'
import ShowChartIcon from '@mui/icons-material/ShowChart'

interface IndexData {
  code: string
  name: string
  type: string
  period: string
  price: number
  bopPrice: number
  change: number
  changePct: number
  lastUpdated: string
}

interface APIResponse {
  data: IndexData[]
}

const indexInfo: Record<string, { name: string }> = {
  'VNINDEX': { name: 'VN-Index' },
  'HNX': { name: 'HNX-Index' },
  'UPCOM': { name: 'UPCOM-Index' },
  'VN30': { name: 'VN30-Index' },
  'VN30F1M': { name: 'VN30F1M' },
  'VN30F2M': { name: 'VN30F2M' },
}

// Define sort order
const sortOrder = ['VNINDEX', 'HNX', 'UPCOM', 'VN30', 'VN30F1M', 'VN30F2M']

const getPriceColor = (change: number): string => {
  if (change > 0) return 'text-green-500'
  if (change < 0) return 'text-red-500'
  return 'text-yellow-500'
}

const getPriceIcon = (change: number): string => {
  if (change > 0) return '▲'
  if (change < 0) return '▼'
  return '▬'
}

// Memoized card component to prevent unnecessary re-renders
const IndexCard = memo(({ index, name }: { index: IndexData; name: string }) => {
  return (
    <div
      className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors duration-300 border border-gray-700"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-white">{name}</span>
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-bold text-white transition-all duration-500 ease-out">
          {index.price.toFixed(2)}
        </div>
        <div className={`text-sm font-semibold transition-all duration-500 ease-out ${getPriceColor(index.change)}`}>
          {getPriceIcon(index.change)}{' '}
          {index.change > 0 ? '+' : ''}{index.change.toFixed(2)}{' '}
          ({index.changePct > 0 ? '+' : ''}{index.changePct.toFixed(2)}%)
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if data actually changed
  return (
    prevProps.index.price === nextProps.index.price &&
    prevProps.index.change === nextProps.index.change &&
    prevProps.index.changePct === nextProps.index.changePct
  )
})

IndexCard.displayName = 'IndexCard'

interface VNIndicesWidgetProps {
  isActive?: boolean
}

export default function VNIndicesWidget({ isActive = true }: VNIndicesWidgetProps) {
  const [indices, setIndices] = useState<IndexData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const fetchIndices = async () => {
    try {
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/change_prices?q=code:VNINDEX,HNX,UPCOM,VN30,VN30F1M,VN30F2M~period:1D'
      )
      if (!response.ok) throw new Error('Failed to fetch data')

      const data: APIResponse = await response.json()
      setIndices(data.data || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching indices:', err)
      // Only show error if we have no data yet
      if (indices.length === 0) {
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
      fetchIndices()
      // Auto refresh every 3 seconds only when tab is active
      const interval = setInterval(fetchIndices, 3000)
      return () => clearInterval(interval)
    }
  }, [mounted, isActive])

  // Only show loading skeleton on initial load
  if (!mounted || (loading && indices.length === 0)) {
    return (
      <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800 w-full max-w-full">
        <div className="animate-pulse space-y-3 sm:space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Show error only if we have no data
  if (error && indices.length === 0) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-red-800">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  // Sort indices according to sortOrder
  const sortedIndices = indices.sort((a, b) => {
    const indexA = sortOrder.indexOf(a.code)
    const indexB = sortOrder.indexOf(b.code)
    // If code not found in sortOrder, put it at the end
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  return (
    <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800 transition-all duration-300 w-full max-w-full overflow-hidden">
      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-5 text-white flex items-center gap-2">
        <ShowChartIcon sx={{ fontSize: { xs: 18, sm: 22, md: 26 } }} />
        Chỉ số chứng khoán Việt Nam
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 md:gap-4">
        {sortedIndices.map((index) => {
          const info = indexInfo[index.code]
          if (!info) return null

          return (
            <IndexCard
              key={index.code}
              index={index}
              name={info.name}
            />
          )
        })}
      </div>

      {indices.length === 0 && (
        <div className="text-center text-gray-400 py-6 sm:py-8">
          Không có dữ liệu chỉ số
        </div>
      )}
    </div>
  )
}
