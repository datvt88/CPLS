'use client'

import { useEffect, useRef, memo } from 'react'
import { createChart, ColorType, Time } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData } from 'lightweight-charts'
import type { StockPriceData, Timeframe, PivotPoints } from '@/types/stock'

interface LightweightChartProps {
  historicalData: StockPriceData[]
  timeframe: Timeframe
  pivotPoints: PivotPoints | null
  floorPrice?: number
  ceilingPrice?: number
}

// Calculate Woodie Pivot Points
export function calculateWoodiePivotPoints(data: StockPriceData[]): PivotPoints | null {
  if (data.length < 2) return null
  const prevDay = data[data.length - 2]
  const { high, low, close } = prevDay
  const pp = (high + low + 2 * close) / 4
  const r3 = high + 2 * (pp - low)
  const s3 = low - 2 * (high - pp)
  return {
    R3: Math.round(r3 * 100) / 100,
    S3: Math.round(s3 * 100) / 100
  }
}

const LightweightChart = memo(({
  historicalData,
  timeframe,
  pivotPoints,
  floorPrice,
  ceilingPrice
}: LightweightChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<{
    candlestick: ISeriesApi<'Candlestick'> | null
    volume: ISeriesApi<'Histogram'> | null
    bbUpper: ISeriesApi<'Line'> | null
    bbMiddle: ISeriesApi<'Line'> | null
    bbLower: ISeriesApi<'Line'> | null
    r3: ISeriesApi<'Line'> | null
    s3: ISeriesApi<'Line'> | null
    ceiling: ISeriesApi<'Line'> | null
    floor: ISeriesApi<'Line'> | null
  }>({
    candlestick: null,
    volume: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    r3: null,
    s3: null,
    ceiling: null,
    floor: null,
  })

  // Initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current) {
      console.error('Chart container ref not available')
      return
    }

    console.log('Initializing lightweight-charts...')

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

    console.log('Chart created successfully')

    // Create all series
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
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
    })

    const bbUpperSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const bbMiddleSeries = chart.addLineSeries({
      color: '#FFD700',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const bbLowerSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const r3Series = chart.addLineSeries({
      color: '#ef5350',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    const s3Series = chart.addLineSeries({
      color: '#26a69a',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    const ceilingSeries = chart.addLineSeries({
      color: '#FF9800',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    const floorSeries = chart.addLineSeries({
      color: '#9C27B0',
      lineWidth: 2,
      lineStyle: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    chartRef.current = chart
    seriesRefs.current = {
      candlestick: candlestickSeries,
      volume: volumeSeries,
      bbUpper: bbUpperSeries,
      bbMiddle: bbMiddleSeries,
      bbLower: bbLowerSeries,
      r3: r3Series,
      s3: s3Series,
      ceiling: ceilingSeries,
      floor: floorSeries,
    }

    console.log('All series created:', Object.keys(seriesRefs.current))

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      console.log('Cleaning up chart...')
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Update data
  useEffect(() => {
    const series = seriesRefs.current
    if (!series.candlestick || !series.volume || historicalData.length === 0) {
      console.log('Chart not ready or no data:', {
        hasCandlestick: !!series.candlestick,
        hasVolume: !!series.volume,
        dataLength: historicalData.length
      })
      return
    }

    try {
      const sortedData = [...historicalData].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      console.log('Setting chart data:', {
        dataPoints: sortedData.length,
        firstDate: sortedData[0]?.date,
        lastDate: sortedData[sortedData.length - 1]?.date
      })

      // Candlestick data with proper Time typing
      const candleData: CandlestickData[] = sortedData.map(d => ({
        time: d.date as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

      // Volume data with proper Time typing
      const volumeData: HistogramData[] = sortedData.map(d => ({
        time: d.date as Time,
        value: d.nmVolume,
        color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
      }))

      series.candlestick.setData(candleData)
      series.volume.setData(volumeData)

      console.log('Candlestick and volume data set successfully')

      // Calculate Bollinger Bands
      if (candleData.length >= 20) {
        const period = 20
        const stdDev = 2
        const bbUpper: LineData[] = []
        const bbMiddle: LineData[] = []
        const bbLower: LineData[] = []

        for (let i = period - 1; i < candleData.length; i++) {
          const slice = candleData.slice(i - period + 1, i + 1)
          const closes = slice.map(d => d.close)
          const mean = closes.reduce((a, b) => a + b, 0) / closes.length
          const variance = closes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / closes.length
          const sd = Math.sqrt(variance)

          bbUpper.push({ time: candleData[i].time, value: mean + stdDev * sd })
          bbMiddle.push({ time: candleData[i].time, value: mean })
          bbLower.push({ time: candleData[i].time, value: mean - stdDev * sd })
        }

        series.bbUpper?.setData(bbUpper)
        series.bbMiddle?.setData(bbMiddle)
        series.bbLower?.setData(bbLower)

        console.log('Bollinger Bands calculated and set:', bbUpper.length, 'points')
      }

      // Pivot points
      if (pivotPoints && candleData.length > 0) {
        const firstTime = candleData[0].time
        const lastTime = candleData[candleData.length - 1].time

        series.r3?.setData([
          { time: firstTime, value: pivotPoints.R3 },
          { time: lastTime, value: pivotPoints.R3 },
        ])

        series.s3?.setData([
          { time: firstTime, value: pivotPoints.S3 },
          { time: lastTime, value: pivotPoints.S3 },
        ])

        console.log('Pivot points set:', { R3: pivotPoints.R3, S3: pivotPoints.S3 })
      }

      // Floor/ceiling
      if (floorPrice && ceilingPrice && candleData.length > 0) {
        const firstTime = candleData[0].time
        const lastTime = candleData[candleData.length - 1].time

        series.ceiling?.setData([
          { time: firstTime, value: ceilingPrice },
          { time: lastTime, value: ceilingPrice },
        ])

        series.floor?.setData([
          { time: firstTime, value: floorPrice },
          { time: lastTime, value: floorPrice },
        ])

        console.log('Floor/ceiling prices set:', { floor: floorPrice, ceiling: ceilingPrice })
      }

      chartRef.current?.timeScale().fitContent()
      console.log('Chart updated successfully')
    } catch (error) {
      console.error('Error updating chart:', error)
    }
  }, [historicalData, timeframe, pivotPoints, floorPrice, ceilingPrice])

  return (
    <div
      ref={chartContainerRef}
      className="w-full"
      style={{ minHeight: '500px' }}
    />
  )
})

LightweightChart.displayName = 'LightweightChart'

export default LightweightChart
