'use client'

import { useEffect, useState, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'

interface VNIndexData {
  date: string
  open: number
  high: number
  low: number
  close: number
  change: number
  pctChange: number
  accumulatedVol: number
  accumulatedVal: number
}

// Helper function to get current date in Vietnam timezone (GMT+7)
function getVietnamDate(): Date {
  const now = new Date()
  const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  vietnamTime.setHours(0, 0, 0, 0)
  return vietnamTime
}

// Helper function to check if date is valid (not from the future)
function isValidTradingDate(dateStr: string): boolean {
  const dataDate = new Date(dateStr)
  dataDate.setHours(0, 0, 0, 0)
  const today = getVietnamDate()
  return dataDate <= today
}

export default function VNIndexChartWidget() {
  const [data, setData] = useState<VNIndexData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          'https://api-finfo.vndirect.com.vn/v4/vnmarket_prices?sort=date:desc&size=300&q=code:VNINDEX'
        )
        const result = await response.json()

        if (result.data && result.data.length > 0) {
          // Filter out future dates and sort by date ascending
          const validData = result.data.filter((item: any) => isValidTradingDate(item.date))
          const sorted = validData.sort((a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          )
          setData(sorted)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Không thể tải dữ liệu')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Initialize and update chart
  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a1a' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    // Set data
    const candleData = data.map(d => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))

    const volumeData = data.map(d => ({
      time: d.date,
      value: d.accumulatedVol,
      color: d.close >= d.open ? '#26a69a' : '#ef5350',
    }))

    candlestickSeries.setData(candleData)
    volumeSeries.setData(volumeData)
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data])

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-[500px] bg-gray-700 rounded"></div>
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

  const latestData = data[data.length - 1]

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">📈 VN-INDEX</h3>
          {latestData && (
            <>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-2xl font-bold text-white">
                  {latestData.close.toFixed(2)}
                </span>
                <span className={`text-sm font-semibold ${
                  latestData.change > 0 ? 'text-green-500' :
                  latestData.change < 0 ? 'text-red-500' : 'text-yellow-500'
                }`}>
                  {latestData.change > 0 ? '▲' : latestData.change < 0 ? '▼' : '▬'}
                  {latestData.change > 0 ? '+' : ''}{latestData.change.toFixed(2)}
                  ({latestData.pctChange > 0 ? '+' : ''}{latestData.pctChange.toFixed(2)}%)
                </span>
              </div>
              {/* Date indicator */}
              <div className="mt-2 text-sm">
                <span className="text-gray-400">📅 </span>
                <span className="text-blue-400 font-medium">
                  {new Date(latestData.date).toLocaleDateString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </span>
                {(() => {
                  const dataDate = new Date(latestData.date)
                  dataDate.setHours(0, 0, 0, 0)
                  const today = getVietnamDate()
                  const diffDays = Math.floor((today.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24))

                  if (diffDays === 0) {
                    return <span className="ml-2 text-green-400 text-xs">✓ Hôm nay</span>
                  } else if (diffDays === 1) {
                    return <span className="ml-2 text-yellow-400 text-xs">⚠ Hôm qua</span>
                  } else if (diffDays > 1) {
                    return <span className="ml-2 text-orange-400 text-xs">⚠ {diffDays} ngày trước</span>
                  }
                  return null
                })()}
              </div>
            </>
          )}
        </div>
        <div className="text-right text-sm text-gray-400">
          {latestData && (
            <>
              <div>KL: {(latestData.accumulatedVol / 1000000).toFixed(2)}M</div>
              <div>GT: {(latestData.accumulatedVal / 1000000000000).toFixed(2)}T</div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} style={{ minHeight: '500px' }} />

      <div className="text-xs text-gray-500 text-center">
        Dữ liệu 300 phiên gần nhất • Cập nhật mỗi 5 phút
      </div>
    </div>
  )
}
