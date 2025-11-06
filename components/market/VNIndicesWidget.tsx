'use client'

import { useEffect, useState } from 'react'

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

const indexInfo: Record<string, { name: string; icon: string }> = {
  'VNINDEX': { name: 'VN-Index', icon: '🇻🇳' },
  'HNX': { name: 'HNX-Index', icon: '🏦' },
  'UPCOM': { name: 'UPCOM-Index', icon: '🏢' },
  'VN30': { name: 'VN30-Index', icon: '⭐' },
  'VN30F1M': { name: 'VN30F1M', icon: '📈' },
  'VN30F2M': { name: 'VN30F2M', icon: '📊' },
}

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

export default function VNIndicesWidget() {
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
      setError('Không thể tải dữ liệu')
      setIndices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      fetchIndices()
      // Auto refresh every 30 seconds
      const interval = setInterval(fetchIndices, 30000)
      return () => clearInterval(interval)
    }
  }, [mounted])

  if (!mounted) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
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
      <h3 className="text-xl font-bold mb-6 text-white">📊 Chỉ số chứng khoán Việt Nam</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {indices.map((index) => {
          const info = indexInfo[index.code]
          if (!info) return null

          return (
            <div
              key={index.code}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{info.icon}</span>
                  <span className="font-semibold text-white">{info.name}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-bold text-white">
                  {index.price.toFixed(2)}
                </div>
                <div className={`text-sm font-semibold ${getPriceColor(index.change)}`}>
                  {getPriceIcon(index.change)}{' '}
                  {index.change > 0 ? '+' : ''}{index.change.toFixed(2)}{' '}
                  ({index.changePct > 0 ? '+' : ''}{index.changePct.toFixed(2)}%)
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {indices.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Không có dữ liệu chỉ số
        </div>
      )}
    </div>
  )
}
