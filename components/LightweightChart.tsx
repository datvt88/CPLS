'use client'

import { useEffect, useRef, memo } from 'react'
import { createChart, ColorType, Time } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData } from 'lightweight-charts'
import type { StockPriceData, Timeframe, PivotPoints } from '@/types/stock'

interface LightweightChartProps {
  historicalData: StockPriceData[]
  timeframe: Timeframe
  pivotPoints: PivotPoints | null
  chartType: 'candlestick' | 'line'
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
  chartType
}: LightweightChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<{
    candlestick: ISeriesApi<'Candlestick'> | null
    line: ISeriesApi<'Line'> | null
    volume: ISeriesApi<'Histogram'> | null
    r3: ISeriesApi<'Line'> | null
    s3: ISeriesApi<'Line'> | null
  }>({
    candlestick: null,
    line: null,
    volume: null,
    r3: null,
    s3: null,
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

    const lineSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
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

    chartRef.current = chart
    seriesRefs.current = {
      candlestick: candlestickSeries,
      line: lineSeries,
      volume: volumeSeries,
      r3: r3Series,
      s3: s3Series,
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
    if (!series.candlestick || !series.line || !series.volume || historicalData.length === 0) {
      console.log('Chart not ready or no data:', {
        hasCandlestick: !!series.candlestick,
        hasLine: !!series.line,
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
        lastDate: sortedData[sortedData.length - 1]?.date,
        chartType
      })

      // Candlestick data with proper Time typing
      const candleData: CandlestickData[] = sortedData.map(d => ({
        time: d.date as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))

      // Line data (closing prices)
      const lineData: LineData[] = sortedData.map(d => ({
        time: d.date as Time,
        value: d.close,
      }))

      // Volume data with proper Time typing
      const volumeData: HistogramData[] = sortedData.map(d => ({
        time: d.date as Time,
        value: d.nmVolume,
        color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
      }))

      // Toggle between candlestick and line chart
      if (chartType === 'candlestick') {
        series.candlestick.setData(candleData)
        series.line.setData([]) // Clear line data
      } else {
        series.line.setData(lineData)
        series.candlestick.setData([]) // Clear candlestick data
      }

      series.volume.setData(volumeData)

      console.log(`${chartType} and volume data set successfully`)

      // Pivot points (R3 - Resistance, S3 - Support) - only show in last 1 month (~30 days)
      if (pivotPoints && candleData.length > 0) {
        // Calculate start index for last 1 month (approximately 30 data points)
        const daysToShow = 30
        const startIndex = Math.max(0, candleData.length - daysToShow)
        const startTime = candleData[startIndex].time
        const lastTime = candleData[candleData.length - 1].time

        series.r3?.setData([
          { time: startTime, value: pivotPoints.R3 },
          { time: lastTime, value: pivotPoints.R3 },
        ])

        series.s3?.setData([
          { time: startTime, value: pivotPoints.S3 },
          { time: lastTime, value: pivotPoints.S3 },
        ])

        console.log('Pivot points set (last 1 month):', { R3: pivotPoints.R3, S3: pivotPoints.S3, startIndex, totalPoints: candleData.length, daysShown: candleData.length - startIndex })
      }

      chartRef.current?.timeScale().fitContent()
      console.log('Chart updated successfully')
    } catch (error) {
      console.error('Error updating chart:', error)
    }
  }, [historicalData, timeframe, pivotPoints, chartType])

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
