'use client'
import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData as LWCCandlestickData } from 'lightweight-charts'

interface CandlestickData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface TradingChartProps {
  data: CandlestickData[]
  height?: number
}

export default function TradingChart({ data, height = 400 }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { color: '#0f1419' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    seriesRef.current = candlestickSeries

    // Set data - convert timestamps to UTC time format
    if (data.length > 0) {
      const formattedData: LWCCandlestickData[] = data.map(d => ({
        time: (d.time / 1000) as any, // Convert ms to seconds for lightweight-charts
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      candlestickSeries.setData(formattedData)
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [height])

  // Update data when it changes
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData: LWCCandlestickData[] = data.map(d => ({
        time: (d.time / 1000) as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      seriesRef.current.setData(formattedData)
    }
  }, [data])

  return (
    <div className="w-full">
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden border border-gray-800" />
    </div>
  )
}
