'use client'

import { useEffect, useState, useRef } from 'react'
import { createChart, ColorType, Time, IChartApi, ISeriesApi } from 'lightweight-charts'
import type { CandlestickData } from 'lightweight-charts'

interface VNIndexData {
  code: string
  floor: string
  date: string
  time: string
  type: string
  open: number
  high: number
  low: number
  close: number
  change: number
  pctChange: number
  accumulatedVol: number
  accumulatedVal: number
  nmVolume: number
  nmValue: number
  ptVolume: number
  ptValue: number
}

interface APIResponse {
  data: VNIndexData[]
}

export default function VNIndexChartWidget() {
  const [data, setData] = useState<VNIndexData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chartReady, setChartReady] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<{
    candlestick: ISeriesApi<'Candlestick'> | null
    volume: ISeriesApi<'Histogram'> | null
  }>({
    candlestick: null,
    volume: null,
  })

  // Fetch data from API
  const fetchData = async () => {
    try {
      console.log('Fetching VN-INDEX data from API...')
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/vnmarket_prices?sort=date:desc&size=300&q=code:VNINDEX'
      )

      console.log('API Response status:', response.status)
      if (!response.ok) throw new Error(`API returned ${response.status}`)

      const result: APIResponse = await response.json()
      console.log('API data received:', result.data?.length, 'records')

      if (!result.data || result.data.length === 0) {
        throw new Error('No data received from API')
      }

      // Sort by date ascending for chart display
      const sortedData = result.data.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      console.log('Data sorted. First:', sortedData[0]?.date, 'Last:', sortedData[sortedData.length - 1]?.date)

      setData(sortedData)
      setError(null)
    } catch (err) {
      console.error('Error fetching VN-INDEX data:', err)
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu VN-INDEX')
    } finally {
      setLoading(false)
    }
  }

  // Initialize chart once - with delay to ensure DOM is ready
  useEffect(() => {
    // Small delay to ensure DOM is fully ready
    const initTimer = setTimeout(() => {
      if (!chartContainerRef.current) {
        console.error('Chart container not found')
        return
      }

      try {
        console.log('Initializing chart...')
        const containerWidth = chartContainerRef.current.clientWidth
        console.log('Container width:', containerWidth)

        const chart = createChart(chartContainerRef.current, {
          width: containerWidth,
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

        // Volume Histogram
        const volumeSeries = chart.addHistogramSeries({
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        })

        // Configure volume scale
        chart.priceScale('volume').applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        })

        chartRef.current = chart
        seriesRefs.current = {
          candlestick: candlestickSeries,
          volume: volumeSeries,
        }

        console.log('Chart initialized successfully')
        setChartReady(true)

        const handleResize = () => {
          if (chartContainerRef.current && chart) {
            chart.applyOptions({ width: chartContainerRef.current.clientWidth })
          }
        }

        window.addEventListener('resize', handleResize)

        return () => {
          window.removeEventListener('resize', handleResize)
          chart.remove()
          chartRef.current = null
          seriesRefs.current = {
            candlestick: null,
            volume: null,
          }
        }
      } catch (error) {
        console.error('Error initializing chart:', error)
      }
    }, 100) // 100ms delay

    return () => clearTimeout(initTimer)
  }, [])

  // Update chart data when data changes
  useEffect(() => {
    if (!chartReady || !data.length || !seriesRefs.current.candlestick || !seriesRefs.current.volume) {
      console.log('Skipping chart update:', {
        chartReady,
        dataLength: data.length,
        hasCandlestick: !!seriesRefs.current.candlestick,
        hasVolume: !!seriesRefs.current.volume,
      })
      return
    }

    try {
      console.log('Updating chart with data:', data.length, 'records')

      const sortedData = [...data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      // Candlestick data
      const candleData: CandlestickData[] = sortedData.map(d => ({
        time: d.date as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

      // Volume data
      const volumeData = sortedData.map(d => ({
        time: d.date as Time,
        value: d.accumulatedVol,
        color: d.close >= d.open ? '#26a69a' : '#ef5350',
      }))

      console.log('Setting candlestick data:', candleData.length)
      seriesRefs.current.candlestick.setData(candleData)

      console.log('Setting volume data:', volumeData.length)
      seriesRefs.current.volume.setData(volumeData)

      console.log('Fitting content...')
      chartRef.current?.timeScale().fitContent()

      console.log('Chart updated successfully')
    } catch (error) {
      console.error('Error updating chart:', error)
    }
  }, [chartReady, data])

  // Fetch data on mount
  useEffect(() => {
    fetchData()
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading && data.length === 0) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-[500px] bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (error && data.length === 0) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-red-800">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Thử lại
        </button>
      </div>
    )
  }

  // Get latest data point for display
  const latestData = data[data.length - 1]
  const priceColor = latestData?.change > 0 ? 'text-green-500' : latestData?.change < 0 ? 'text-red-500' : 'text-yellow-500'
  const priceIcon = latestData?.change > 0 ? '▲' : latestData?.change < 0 ? '▼' : '▬'

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">📈 VN-INDEX</h3>
          {latestData && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-bold text-white">
                {latestData.close.toFixed(2)}
              </span>
              <span className={`text-sm font-semibold ${priceColor}`}>
                {priceIcon} {latestData.change > 0 ? '+' : ''}{latestData.change.toFixed(2)} ({latestData.pctChange > 0 ? '+' : ''}{latestData.pctChange.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <div className="text-right text-sm text-gray-400">
          {latestData && (
            <>
              <div>KL: {(latestData.accumulatedVol / 1000000).toFixed(2)}M</div>
              <div>GT: {(latestData.accumulatedVal / 1000000000000).toFixed(2)}T VNĐ</div>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <div ref={chartContainerRef} className="w-full" style={{ minHeight: '500px' }} />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[--panel]/90 rounded-lg">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400 text-lg">Đang tải dữ liệu biểu đồ...</p>
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 text-center">
        Dữ liệu 300 phiên gần nhất • Cập nhật mỗi 5 phút
      </div>
    </div>
  )
}
