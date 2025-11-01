'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { useTheme } from 'next-themes'
import {
  createChart,
  ColorType,
  ISeriesApi,
  IChartApi,
  Time,
  CandlestickData,
  HistogramData,
  WhitespaceData,
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

  const bands = []
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const closePrices = slice.map((d) => d.close)
    const middle = sma(closePrices)
    const standardDeviation = std(closePrices, middle)
    const time = slice[slice.length - 1].time

    bands.push({
      time,
      upper: middle + stdDev * standardDeviation,
      middle,
      lower: middle - stdDev * standardDeviation,
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
}

// --- Main Component ---
const LightweightChart = memo(({ historicalData, timeframe, pivotPoints }: LightweightChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<{ chart?: IChartApi; series?: Record<string, ISeriesApi<any>> }>({})
  const { resolvedTheme } = useTheme()

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 450,
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false },
    })

    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.2, bottom: 0.15 },
    })

    const series = {
      main: chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        wickUpColor: '#26a69a',
      }),
      volume: chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume_scale',
      }),
      bbUpper: chart.addLineSeries({
        color: 'green',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      }),
      bbMiddle: chart.addLineSeries({
        color: '#ffd900',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      }),
      bbLower: chart.addLineSeries({
        color: 'green',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      }),
      s3: chart.addLineSeries({
        color: '#34c763',
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      }),
      r3: chart.addLineSeries({
        color: '#ff453a',
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      }),
    }

    chart.priceScale('volume_scale').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })

    chartRef.current = { chart, series }

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = {}
    }
  }, [])

  // Update theme
  useEffect(() => {
    const { chart } = chartRef.current
    if (!chart) return

    const isDark = resolvedTheme === 'dark'

    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#131722' : '#FFFFFF' },
        textColor: isDark ? '#FFF' : '#191919',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
      },
    })
  }, [resolvedTheme])

  // Memoize processed data
  const processedData = useMemo(() => {
    if (historicalData.length === 0) return null

    const sortedData = [...historicalData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    const aggregated = aggregateData(sortedData, timeframe)

    const mainData: (CandlestickData | WhitespaceData)[] = aggregated.map((d) => ({
      time: (new Date(d.date).getTime() / 1000) as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))

    const volumeData: (HistogramData | WhitespaceData)[] = aggregated.map((d) => ({
      time: (new Date(d.date).getTime() / 1000) as Time,
      value: d.nmVolume,
      color: d.close > d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
    }))

    const bbPeriod = timeframe === '1m' ? 10 : 30
    const bbData = calculateBollingerBands(mainData as CandlestickData[], bbPeriod, 3)

    let s3Data: any[] = []
    let r3Data: any[] = []
    if (pivotPoints && pivotPoints.S3 && pivotPoints.R3 && mainData.length > 0) {
      const lastDataPoint = mainData[mainData.length - 1] as CandlestickData
      const lastTimestamp = lastDataPoint.time as number
      const twoWeeksAgo = lastTimestamp - 14 * 24 * 60 * 60
      const fiveDaysFuture = lastTimestamp + 5 * 24 * 60 * 60
      s3Data = [
        { time: twoWeeksAgo as Time, value: pivotPoints.S3 },
        { time: fiveDaysFuture as Time, value: pivotPoints.S3 },
      ]
      r3Data = [
        { time: twoWeeksAgo as Time, value: pivotPoints.R3 },
        { time: fiveDaysFuture as Time, value: pivotPoints.R3 },
      ]
    }

    return { mainData, volumeData, bbData, s3Data, r3Data }
  }, [historicalData, timeframe, pivotPoints])

  // Update chart with data
  useEffect(() => {
    const { chart, series } = chartRef.current
    if (!chart || !series || !processedData) return

    const { mainData, volumeData, bbData, s3Data, r3Data } = processedData

    series.main.setData(mainData)
    series.volume.setData(volumeData)
    series.bbUpper.setData(bbData.map((d) => ({ time: d.time, value: d.upper })))
    series.bbMiddle.setData(bbData.map((d) => ({ time: d.time, value: d.middle })))
    series.bbLower.setData(bbData.map((d) => ({ time: d.time, value: d.lower })))
    series.s3.setData(s3Data)
    series.r3.setData(r3Data)

    if (mainData.length > 0) {
      const quarterIndex = Math.floor((mainData.length * 3) / 4)
      chart.timeScale().setVisibleRange({
        from: mainData[quarterIndex].time,
        to: mainData[mainData.length - 1].time,
      })
    } else {
      chart.timeScale().fitContent()
    }
  }, [processedData])

  return <div ref={chartContainerRef} className="h-[450px] w-full" />
})

LightweightChart.displayName = 'LightweightChart'

export default LightweightChart
