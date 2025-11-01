'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  createChart,
  ColorType,
  ISeriesApi,
  IChartApi,
  Time,
  CandlestickData,
  HistogramData,
  LineData,
} from 'lightweight-charts'
import type { StockPriceData, Timeframe, PivotPoints } from '@/types/stock'

// --- Utility Functions ---

// Custom rounding to nearest 5 cents
function roundToNearest5(num: number): number {
  return Math.round((num * 100) / 5) * 5 / 100
}

// Woodie Pivot Points Calculation (Daily)
export function calculateWoodiePivotPoints(data: StockPriceData[]): PivotPoints | null {
  if (data.length < 2) return null
  const prevDay = data[data.length - 2]
  const { high, low, close } = prevDay
  const pp = (high + low + 2 * close) / 4
  const r3 = high + 2 * (pp - low)
  const s3 = low - 2 * (high - pp)
  return { R3: roundToNearest5(r3), S3: roundToNearest5(s3) }
}

// Bollinger Bands Calculation
function calculateBollingerBands(
  data: CandlestickData[],
  period: number,
  stdDev: number
) {
  if (data.length < period) return []

  const sma = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const std = (arr: number[], mean: number) =>
    Math.sqrt(
      arr.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / arr.length
    )

  const bands: LineData[] = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const closePrices = slice.map((d) => d.close)
    const middle = sma(closePrices)
    const standardDeviation = std(closePrices, middle)
    const time = slice[slice.length - 1].time

    bands.push({
      time,
      value: middle + stdDev * standardDeviation,
    })
  }
  return bands
}

// Data Aggregation by Timeframe
const aggregateData = (data: StockPriceData[], timeframe: Timeframe): StockPriceData[] => {
  if (timeframe === '1d') return data

  const getGroupKey = (date: Date) => {
    const year = date.getUTCFullYear()
    if (timeframe === '1m') return `${year}-${date.getUTCMonth()}`
    if (timeframe === '1w') {
      const firstDayOfYear = new Date(Date.UTC(year, 0, 1))
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
      return `${year}-w${Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7)}`
    }
    return ''
  }

  const groups = data.reduce((acc, curr) => {
    const key = getGroupKey(new Date(curr.date))
    if (!acc[key]) acc[key] = []
    acc[key].push(curr)
    return acc
  }, {} as Record<string, StockPriceData[]>)

  return Object.values(groups).map((group) => {
    const first = group[0]
    const last = group[group.length - 1]
    return {
      ...last,
      open: first.open,
      high: Math.max(...group.map((d) => d.high)),
      low: Math.min(...group.map((d) => d.low)),
      close: last.close,
      nmVolume: group.reduce((sum, d) => sum + d.nmVolume, 0),
    }
  })
}

// --- Component Props ---
interface LightweightChartProps {
  historicalData: StockPriceData[]
  timeframe: Timeframe
  pivotPoints: PivotPoints | null
  floorPrice?: number
  ceilingPrice?: number
}

// --- Main Component ---
const LightweightChart = memo(({
  historicalData,
  timeframe,
  pivotPoints,
  floorPrice,
  ceilingPrice
}: LightweightChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null)
  const s3Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const r3Ref = useRef<ISeriesApi<'Line'> | null>(null)
  const floorRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ceilingRef = useRef<ISeriesApi<'Line'> | null>(null)

  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(197, 203, 206, 0.4)',
      },
      timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.4)',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a',
    })

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    // Add Bollinger Bands
    const bbUpper = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const bbMiddle = chart.addLineSeries({
      color: '#ffd900',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const bbLower = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    // Add S3/R3 pivot lines
    const s3Line = chart.addLineSeries({
      color: '#26a69a',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      title: 'S3',
    })

    const r3Line = chart.addLineSeries({
      color: '#ef5350',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      title: 'R3',
    })

    // Add floor/ceiling price lines
    const floorLine = chart.addLineSeries({
      color: '#9C27B0',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      title: 'Sàn',
    })

    const ceilingLine = chart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
      title: 'Trần',
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries
    bbUpperRef.current = bbUpper
    bbMiddleRef.current = bbMiddle
    bbLowerRef.current = bbLower
    s3Ref.current = s3Line
    r3Ref.current = r3Line
    floorRef.current = floorLine
    ceilingRef.current = ceilingLine

    setMounted(true)

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
    }
  }, [])

  // Update theme
  useEffect(() => {
    if (!chartRef.current) return

    const isDark = resolvedTheme === 'dark'

    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#131722' : '#FFFFFF' },
        textColor: isDark ? '#d1d4dc' : '#191919',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(42, 46, 57, 0.5)' : 'rgba(197, 203, 206, 0.5)' },
        horzLines: { color: isDark ? 'rgba(42, 46, 57, 0.5)' : 'rgba(197, 203, 206, 0.5)' },
      },
    })
  }, [resolvedTheme])

  // Update chart data
  useEffect(() => {
    if (!mounted || !candlestickSeriesRef.current || historicalData.length === 0) return

    try {
      // Sort and aggregate data
      const sortedData = [...historicalData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      const aggregated = aggregateData(sortedData, timeframe)

      // Convert to candlestick data
      const candleData: CandlestickData[] = aggregated.map((d) => ({
        time: d.date as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

      // Volume data
      const volumeData: HistogramData[] = aggregated.map((d) => ({
        time: d.date as Time,
        value: d.nmVolume,
        color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
      }))

      // Set candlestick and volume data
      candlestickSeriesRef.current.setData(candleData)
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volumeData)
      }

      // Calculate and set Bollinger Bands
      if (candleData.length >= 20) {
        const period = timeframe === '1m' ? 10 : 20
        const bbPeriod = Math.min(period, candleData.length)

        const bbUpperData: LineData[] = []
        const bbMiddleData: LineData[] = []
        const bbLowerData: LineData[] = []

        for (let i = bbPeriod - 1; i < candleData.length; i++) {
          const slice = candleData.slice(i - bbPeriod + 1, i + 1)
          const closes = slice.map(d => d.close)
          const mean = closes.reduce((a, b) => a + b, 0) / closes.length
          const variance = closes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / closes.length
          const stdDev = Math.sqrt(variance)

          bbUpperData.push({ time: candleData[i].time, value: mean + 2 * stdDev })
          bbMiddleData.push({ time: candleData[i].time, value: mean })
          bbLowerData.push({ time: candleData[i].time, value: mean - 2 * stdDev })
        }

        if (bbUpperRef.current) bbUpperRef.current.setData(bbUpperData)
        if (bbMiddleRef.current) bbMiddleRef.current.setData(bbMiddleData)
        if (bbLowerRef.current) bbLowerRef.current.setData(bbLowerData)
      }

      // Set pivot points
      if (pivotPoints && candleData.length > 0) {
        const firstTime = candleData[0].time
        const lastTime = candleData[candleData.length - 1].time

        if (s3Ref.current && pivotPoints.S3) {
          s3Ref.current.setData([
            { time: firstTime, value: pivotPoints.S3 },
            { time: lastTime, value: pivotPoints.S3 },
          ])
        }

        if (r3Ref.current && pivotPoints.R3) {
          r3Ref.current.setData([
            { time: firstTime, value: pivotPoints.R3 },
            { time: lastTime, value: pivotPoints.R3 },
          ])
        }
      }

      // Set floor/ceiling prices
      if (floorPrice && ceilingPrice && candleData.length > 0) {
        const firstTime = candleData[0].time
        const lastTime = candleData[candleData.length - 1].time

        if (floorRef.current) {
          floorRef.current.setData([
            { time: firstTime, value: floorPrice },
            { time: lastTime, value: floorPrice },
          ])
        }

        if (ceilingRef.current) {
          ceilingRef.current.setData([
            { time: firstTime, value: ceilingPrice },
            { time: lastTime, value: ceilingPrice },
          ])
        }
      }

      // Fit content
      if (chartRef.current && candleData.length > 0) {
        chartRef.current.timeScale().fitContent()
      }
    } catch (error) {
      console.error('Error updating chart:', error)
    }
  }, [mounted, historicalData, timeframe, pivotPoints, floorPrice, ceilingPrice])

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="w-full" />
      {!mounted && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#131722] rounded-lg">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải biểu đồ...</p>
          </div>
        </div>
      )}
    </div>
  )
})

LightweightChart.displayName = 'LightweightChart'

export default LightweightChart
