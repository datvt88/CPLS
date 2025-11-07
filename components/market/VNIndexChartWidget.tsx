'use client'

import { useEffect, useState, useRef } from 'react'
import { createChart, ColorType, Time } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData } from 'lightweight-charts'

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
  const [mounted, setMounted] = useState(false)
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
      console.log('Fetching VN-INDEX data...')
      const response = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/vnmarket_prices?sort=date:desc&size=300&q=code:VNINDEX'
      )
      if (!response.ok) throw new Error('Failed to fetch data')

      const result: APIResponse = await response.json()
      console.log('VN-INDEX data received:', result.data?.length, 'records')

      // Sort by date ascending for chart display
      const sortedData = result.data.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      console.log('First record:', sortedData[0])
      console.log('Last record:', sortedData[sortedData.length - 1])

      setData(sortedData)
      setError(null)
    } catch (err) {
      console.error('Error fetching VN-INDEX data:', err)
      setError('Không thể tải dữ liệu VN-INDEX')
    } finally {
      setLoading(false)
    }
  }

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize chart
  useEffect(() => {
    if (!mounted || !chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 450,
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
        borderColor: '#2a2e39',
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
    })

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    // Create volume series with proper scale configuration
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    // Configure volume scale to display at bottom
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

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [mounted])

  // Update chart data
  useEffect(() => {
    const series = seriesRefs.current
    if (!series.candlestick || !series.volume || data.length === 0) {
      console.log('Skipping chart update:', {
        hasCandlestick: !!series.candlestick,
        hasVolume: !!series.volume,
        dataLength: data.length
      })
      return
    }

    try {
      console.log('Updating chart with', data.length, 'data points')

      // Prepare candlestick data
      const candleData: CandlestickData[] = data.map(d => ({
        time: d.date as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

      // Prepare volume data with color based on price movement
      const volumeData: HistogramData[] = data.map(d => ({
        time: d.date as Time,
        value: d.accumulatedVol,
        color: d.close >= d.open ? '#26a69a' : '#ef5350',
      }))

      console.log('Setting candlestick data:', candleData.length, 'candles')
      series.candlestick.setData(candleData)

      console.log('Setting volume data:', volumeData.length, 'bars')
      series.volume.setData(volumeData)

      chartRef.current?.timeScale().fitContent()
      console.log('Chart updated successfully')
    } catch (error) {
      console.error('Error updating chart:', error)
    }
  }, [data])

  // Fetch data on mount
  useEffect(() => {
    if (!mounted) return

    fetchData()
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [mounted])

  // Show loading skeleton on initial mount or when loading with no data
  if (!mounted || (loading && data.length === 0)) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-[450px] bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  // Show error only if we have no data
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
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
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
              <div>Khối lượng: {(latestData.accumulatedVol / 1000000).toFixed(2)}M</div>
              <div>Giá trị: {(latestData.accumulatedVal / 1000000000000).toFixed(2)}T VNĐ</div>
            </>
          )}
        </div>
      </div>

      <div
        ref={chartContainerRef}
        className="w-full"
        style={{ minHeight: '450px' }}
      />

      <div className="mt-2 text-xs text-gray-500 text-center">
        Dữ liệu 300 phiên gần nhất • Cập nhật mỗi 5 phút
      </div>
    </div>
  )
}
