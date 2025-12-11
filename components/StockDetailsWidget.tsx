'use client'

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react'
import { createChart, ColorType, Time, IChartApi, ISeriesApi, SeriesMarker } from 'lightweight-charts'
import type { CandlestickData, LineData } from 'lightweight-charts'
import { calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import { fetchStockPricesClient } from '@/services/vndirect-client'
import type { StockPriceData, WoodiePivotPoints } from '@/types/vndirect'
import { formatVolume, formatCurrency, formatPrice, formatChange } from '@/utils/formatters'
import { useStockHubOptional } from '@/contexts/StockHubContext'

interface StockDetailsWidgetProps {
  initialSymbol?: string
  onSymbolChange?: (symbol: string) => void
}

// Data cache to avoid redundant API calls
// Clear cache on app restart to avoid stale data from old API versions
const dataCache = new Map<string, { data: StockPriceData[], timestamp: number }>()
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes (reduced for fresher trading data)

// Helper function to calculate Simple Moving Average
function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0)
      result.push(sum / period)
    }
  }

  return result
}

// Helper function to get current date in Vietnam timezone (GMT+7)
// Returns end-of-day for consistent date comparisons
function getVietnamDate(): Date {
  const now = new Date()
  // Convert to Vietnam timezone (UTC+7)
  const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  vietnamTime.setHours(23, 59, 59, 999)
  return vietnamTime
}

const StockDetailsWidget = memo(({ initialSymbol = 'VNM', onSymbolChange }: StockDetailsWidgetProps) => {
  // Stock Hub integration (optional - works with or without provider)
  const stockHub = useStockHubOptional()

  // Use Stock Hub symbol if available, otherwise fall back to props
  const effectiveInitialSymbol = stockHub?.currentSymbol ?? initialSymbol

  const [symbol, setSymbol] = useState(effectiveInitialSymbol)
  const [inputSymbol, setInputSymbol] = useState(effectiveInitialSymbol)
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M'>('1D')
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stockData, setStockData] = useState<StockPriceData[]>([])
  const [pivotPoints, setPivotPoints] = useState<WoodiePivotPoints | null>(null)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // AbortController ref to cancel in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Watchlist state
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [isInWatchlist, setIsInWatchlist] = useState(false)

  // Clear data cache on mount to avoid stale data from previous API versions
  useEffect(() => {
    dataCache.clear()
    console.log('🗑️ Cleared stock data cache on component mount')
  }, [])

  // Load watchlist from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stock_watchlist')
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        setWatchlist(parsed)
      }
    } catch (err) {
      console.error('Error loading watchlist:', err)
    }
  }, [])

  // Update isInWatchlist when symbol or watchlist changes
  useEffect(() => {
    setIsInWatchlist(watchlist.includes(symbol))
  }, [symbol, watchlist])

  // Save watchlist to localStorage whenever it changes
  const saveWatchlist = useCallback((newWatchlist: string[]) => {
    try {
      localStorage.setItem('stock_watchlist', JSON.stringify(newWatchlist))
      setWatchlist(newWatchlist)
    } catch (err) {
      console.error('Error saving watchlist:', err)
    }
  }, [])

  // Toggle symbol in watchlist
  const toggleWatchlist = useCallback(() => {
    if (isInWatchlist) {
      // Remove from watchlist
      const newWatchlist = watchlist.filter(s => s !== symbol)
      saveWatchlist(newWatchlist)
    } else {
      // Add to watchlist (max 10 symbols)
      if (watchlist.length >= 10) {
        alert('Bạn chỉ có thể theo dõi tối đa 10 mã cổ phiếu')
        return
      }
      const newWatchlist = [...watchlist, symbol]
      saveWatchlist(newWatchlist)
    }
  }, [symbol, isInWatchlist, watchlist, saveWatchlist])

  // Quick switch to watchlist symbol
  const switchToSymbol = useCallback((newSymbol: string) => {
    setSymbol(newSymbol)
    setInputSymbol(newSymbol)
    // Update Stock Hub if available
    stockHub?.setCurrentSymbol(newSymbol)
    onSymbolChange?.(newSymbol)
  }, [onSymbolChange, stockHub])

  // Sync with external symbol changes (from props or Stock Hub)
  useEffect(() => {
    const targetSymbol = stockHub?.currentSymbol ?? initialSymbol
    if (targetSymbol && targetSymbol !== symbol) {
      setSymbol(targetSymbol)
      setInputSymbol(targetSymbol)
    }
  }, [stockHub?.currentSymbol, initialSymbol])

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<{
    candlestick: ISeriesApi<'Candlestick'> | null
    line: ISeriesApi<'Line'> | null
    bbUpper: ISeriesApi<'Line'> | null
    bbMiddle: ISeriesApi<'Line'> | null
    bbLower: ISeriesApi<'Line'> | null
    s2Line: ISeriesApi<'Line'> | null
    r3Line: ISeriesApi<'Line'> | null
    volume: ISeriesApi<'Histogram'> | null
  }>({
    candlestick: null,
    line: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    s2Line: null,
    r3Line: null,
    volume: null,
  })

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) {
      return
    }

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

    const lineSeries = chart.addLineSeries({
      color: '#9333ea',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const bbUpperSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lineStyle: 0,  // Solid line
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const bbMiddleSeries = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 1,
      lineStyle: 0,  // Solid line
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const bbLowerSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lineStyle: 0,  // Solid line
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // S2 Line (Buy T+ - Support)
    const s2LineSeries = chart.addLineSeries({
      color: '#22c55e',
      lineWidth: 2,
      lineStyle: 2,  // Dashed line
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Buy T+',
    })

    // R3 Line (Sell T+ - Resistance)
    const r3LineSeries = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 2,
      lineStyle: 2,  // Dashed line
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Sell T+',
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
      line: lineSeries,
      bbUpper: bbUpperSeries,
      bbMiddle: bbMiddleSeries,
      bbLower: bbLowerSeries,
      s2Line: s2LineSeries,
      r3Line: r3LineSeries,
      volume: volumeSeries,
    }

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)

      // Clean up all series references before removing chart
      if (seriesRefs.current) {
        seriesRefs.current.candlestick = null
        seriesRefs.current.line = null
        seriesRefs.current.bbUpper = null
        seriesRefs.current.bbMiddle = null
        seriesRefs.current.bbLower = null
        seriesRefs.current.s2Line = null
        seriesRefs.current.r3Line = null
        seriesRefs.current.volume = null
      }

      // Remove chart instance
      chart.remove()
      chartRef.current = null
    }
  }, [])

  // Fetch stock data with caching
  const loadStockData = useCallback(async (stockSymbol: string, forceRefresh: boolean = false) => {
    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setError(null)

    try {
      // Check cache first (skip if force refresh)
      if (!forceRefresh) {
        const cached = dataCache.get(stockSymbol)
        const now = Date.now()

        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          // Use cached data
          setStockData(cached.data)

          // Calculate pivot points from cached data
          if (cached.data.length >= 2) {
            const prevDay = cached.data[cached.data.length - 2]
            const pivots = calculateWoodiePivotPoints(prevDay.high, prevDay.low, prevDay.close)
            setPivotPoints(pivots)
          }
          setLoading(false)
          return
        }
      }

      // Clear cache if force refresh
      if (forceRefresh) {
        dataCache.delete(stockSymbol)
      }

      // Fetch fresh data directly from VNDirect (client-side to avoid 403)
      console.log('📈 Loading stock prices for:', stockSymbol, forceRefresh ? '(force refresh)' : '')
      const response = await fetchStockPricesClient(stockSymbol, 150, abortController.signal)

      if (!response.data || response.data.length === 0) {
        throw new Error('Không tìm thấy dữ liệu cho mã này')
      }

      console.log('✅ Stock prices loaded:', response.data.length, 'records')

      // Sort by date ascending (oldest first) for chart display
      const sortedData = [...response.data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      if (sortedData.length === 0) {
        throw new Error('Không có dữ liệu hợp lệ cho mã này')
      }

      // Cache the data with current timestamp
      const now = Date.now()
      dataCache.set(stockSymbol, { data: sortedData, timestamp: now })

      setStockData(sortedData)
      setLastRefreshTime(new Date())

      // Debug logging after setting stock data
      if (sortedData.length > 0) {
        const latest = sortedData[sortedData.length - 1]
        console.log('🔵 Stock data set - latest record:', {
          date: latest.date,
          close: latest.close,
          adClose: latest.adClose,
          open: latest.open,
          high: latest.high,
          low: latest.low,
        })
      }

      // Calculate pivot points from previous day (using adjusted prices)
      let calculatedPivots: WoodiePivotPoints | null = null
      if (sortedData.length >= 2) {
        const prevDay = sortedData[sortedData.length - 2]
        calculatedPivots = calculateWoodiePivotPoints(prevDay.adHigh, prevDay.adLow, prevDay.adClose)
        setPivotPoints(calculatedPivots)
      }

      // Push data to Stock Hub if available
      if (stockHub) {
        stockHub.setPrices(sortedData)

        // Calculate and push technical indicators
        if (sortedData.length >= 30) {
          const closePrices = sortedData.map(d => d.adClose)
          const bb = calculateBollingerBands(closePrices, 30, 3)
          const lastIdx = closePrices.length - 1

          // Calculate MA10
          let ma10: number | null = null
          if (closePrices.length >= 10) {
            const sum10 = closePrices.slice(-10).reduce((acc, val) => acc + val, 0)
            ma10 = sum10 / 10
          }

          // Calculate MA30
          let ma30: number | null = null
          if (closePrices.length >= 30) {
            const sum30 = closePrices.slice(-30).reduce((acc, val) => acc + val, 0)
            ma30 = sum30 / 30
          }

          // Calculate momentum
          const momentum5d = closePrices.length >= 5
            ? ((closePrices[lastIdx] - closePrices[lastIdx - 5]) / closePrices[lastIdx - 5]) * 100
            : null
          const momentum10d = closePrices.length >= 10
            ? ((closePrices[lastIdx] - closePrices[lastIdx - 10]) / closePrices[lastIdx - 10]) * 100
            : null

          stockHub.setTechnicalIndicators({
            ma10,
            ma30,
            bollinger: {
              upper: bb.upper[lastIdx],
              middle: bb.middle[lastIdx],
              lower: bb.lower[lastIdx],
            },
            pivotPoints: calculatedPivots,
            momentum5d,
            momentum10d,
          })
        }
      }
    } catch (err) {
      // Ignore abort errors (user cancelled the request)
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('⚠️ Data loading cancelled for:', stockSymbol)
        return
      }
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      // Only clear loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [stockHub])

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    if (symbol && !loading && !isRefreshing) {
      setIsRefreshing(true)
      loadStockData(symbol, true)
    }
  }, [symbol, loading, isRefreshing, loadStockData])

  // Load data when symbol changes
  useEffect(() => {
    if (symbol) {
      loadStockData(symbol)
    }
  }, [symbol, loadStockData])

  // Auto-refresh every 5 minutes when tab is active
  useEffect(() => {
    if (!symbol) return

    const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

    // Set up interval for auto-refresh
    const intervalId = setInterval(() => {
      // Only refresh if document is visible (tab is active)
      if (!document.hidden && !loading && !isRefreshing) {
        console.log('🔄 Auto-refreshing stock data...')
        loadStockData(symbol, true)
      }
    }, AUTO_REFRESH_INTERVAL)

    // Also refresh when tab becomes visible again (if data is old)
    const handleVisibilityChange = () => {
      if (!document.hidden && lastRefreshTime) {
        const timeSinceRefresh = Date.now() - lastRefreshTime.getTime()
        // Refresh if last refresh was more than 5 minutes ago
        if (timeSinceRefresh > AUTO_REFRESH_INTERVAL && !loading && !isRefreshing) {
          console.log('🔄 Tab became visible, refreshing old data...')
          loadStockData(symbol, true)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [symbol, loading, isRefreshing, lastRefreshTime, loadStockData])

  // Memoize aggregated data based on timeframe
  const displayData = useMemo(() => {
    if (!stockData.length) return []

    if (timeframe === '1W') {
      return aggregateWeekly(stockData)
    } else if (timeframe === '1M') {
      return aggregateMonthly(stockData)
    }

    return stockData
  }, [stockData, timeframe])

  // Memoize chart data (using adjusted prices for accurate historical comparison)
  const chartData = useMemo(() => {
    if (!displayData.length) return { candleData: [], lineData: [], closePrices: [], volumeData: [] }

    const candleData: CandlestickData[] = displayData.map(d => ({
      time: d.date as Time,
      open: d.adOpen,
      high: d.adHigh,
      low: d.adLow,
      close: d.adClose,
    }))

    const lineData: LineData[] = displayData.map(d => ({
      time: d.date as Time,
      value: d.adClose,
    }))

    const closePrices = displayData.map(d => d.adClose)

    const volumeData = displayData.map(d => ({
      time: d.date as Time,
      value: d.nmVolume,
      color: d.adClose >= d.adOpen ? '#26a69a' : '#ef5350',
    }))

    return { candleData, lineData, closePrices, volumeData }
  }, [displayData])

  // Memoize Bollinger Bands
  const bollingerBands = useMemo(() => {
    if (!chartData.closePrices.length) return { upper: [], middle: [], lower: [] }

    const bb = calculateBollingerBands(chartData.closePrices, 30, 3)

    const bbUpperData: LineData[] = displayData.map((d, i) => ({
      time: d.date as Time,
      value: bb.upper[i],
    })).filter(d => !isNaN(d.value))

    const bbMiddleData: LineData[] = displayData.map((d, i) => ({
      time: d.date as Time,
      value: bb.middle[i],
    })).filter(d => !isNaN(d.value))

    const bbLowerData: LineData[] = displayData.map((d, i) => ({
      time: d.date as Time,
      value: bb.lower[i],
    })).filter(d => !isNaN(d.value))

    return { upper: bbUpperData, middle: bbMiddleData, lower: bbLowerData }
  }, [chartData.closePrices, displayData])

  // Memoize pivot lines data to avoid recalculation
  const pivotLinesData = useMemo(() => {
    if (!pivotPoints || !displayData.length) {
      return { s2Data: [], r3Data: [] }
    }

    const last30Sessions = displayData.slice(-30)

    const s2Data: LineData[] = last30Sessions.map(d => ({
      time: d.date as Time,
      value: pivotPoints.S2,
    }))

    const r3Data: LineData[] = last30Sessions.map(d => ({
      time: d.date as Time,
      value: pivotPoints.R3,
    }))

    return { s2Data, r3Data }
  }, [pivotPoints, displayData])

  // Calculate MA10 and MA30 for all data points
  const movingAverages = useMemo(() => {
    if (!chartData.closePrices.length) return { ma10: null, ma10Array: [], ma30Array: [] }

    const closePrices = chartData.closePrices

    // Calculate MA10 array for all data points
    const ma10Array = calculateSMA(closePrices, 10)

    // Calculate MA30 array for all data points
    const ma30Array = calculateSMA(closePrices, 30)

    // Calculate current MA10 (last value)
    let ma10: number | null = null
    if (closePrices.length >= 10) {
      const sum10 = closePrices.slice(-10).reduce((acc, val) => acc + val, 0)
      ma10 = sum10 / 10
    }

    return { ma10, ma10Array, ma30Array }
  }, [chartData.closePrices])

  // Detect MA10/MA30 crossover points and create markers
  const crossoverMarkers = useMemo(() => {
    if (!displayData.length || !movingAverages.ma10Array.length || !movingAverages.ma30Array.length) {
      return []
    }

    const markers: SeriesMarker<Time>[] = []
    const ma10Array = movingAverages.ma10Array
    const ma30Array = movingAverages.ma30Array

    // Start from index 30 to ensure both MA10 and MA30 are valid
    for (let i = 30; i < displayData.length; i++) {
      const ma10Current = ma10Array[i]
      const ma30Current = ma30Array[i]
      const ma10Previous = ma10Array[i - 1]
      const ma30Previous = ma30Array[i - 1]

      // Skip if any values are null
      if (ma10Current === null || ma30Current === null || ma10Previous === null || ma30Previous === null) {
        continue
      }

      // Golden Cross (Buy signal): MA10 crosses above MA30
      if (ma10Previous <= ma30Previous && ma10Current > ma30Current) {
        markers.push({
          time: displayData[i].date as Time,
          position: 'belowBar',
          color: '#22c55e', // green
          shape: 'arrowUp',
          text: 'Buy',
        })
      }

      // Death Cross (Sell signal): MA10 crosses below MA30
      if (ma10Previous >= ma30Previous && ma10Current < ma30Current) {
        markers.push({
          time: displayData[i].date as Time,
          position: 'aboveBar',
          color: '#ef4444', // red
          shape: 'arrowDown',
          text: 'Sell',
        })
      }
    }

    return markers
  }, [displayData, movingAverages.ma10Array, movingAverages.ma30Array])

  // Update chart when data or settings change
  useEffect(() => {
    if (!displayData.length || !seriesRefs.current.candlestick) {
      return
    }

    const series = seriesRefs.current

    // Show/hide series based on chart type
    if (chartType === 'candlestick') {
      series.candlestick.setData(chartData.candleData)
      series.line?.setData([]) // Hide line series
      // Set markers on candlestick series
      series.candlestick.setMarkers(crossoverMarkers)
    } else {
      series.line?.setData(chartData.lineData)
      series.candlestick.setData([]) // Hide candlestick series
      // Set markers on line series
      series.line?.setMarkers(crossoverMarkers)
    }

    series.bbUpper?.setData(bollingerBands.upper)
    series.bbMiddle?.setData(bollingerBands.middle)
    series.bbLower?.setData(bollingerBands.lower)

    // Draw S2 and R3 lines for last 30 sessions
    series.s2Line?.setData(pivotLinesData.s2Data)
    series.r3Line?.setData(pivotLinesData.r3Data)

    // Update volume data
    series.volume?.setData(chartData.volumeData)

    chartRef.current?.timeScale().fitContent()
  }, [displayData, chartType, chartData, bollingerBands, pivotLinesData, crossoverMarkers])

  const handleSearch = useCallback(() => {
    if (inputSymbol.trim()) {
      const newSymbol = inputSymbol.trim().toUpperCase()
      console.log('🔍 Symbol changed to:', newSymbol)
      setSymbol(newSymbol)
      // Update Stock Hub if available (this will trigger other widgets to update)
      stockHub?.setCurrentSymbol(newSymbol)
      // Also call legacy callback for backwards compatibility
      onSymbolChange?.(newSymbol)
    }
  }, [inputSymbol, onSymbolChange, stockHub])

  const latestData = stockData[stockData.length - 1]

  // Debug logging for price display
  if (latestData) {
    console.log('🎯 Latest data for display:', {
      symbol: symbol,
      date: latestData.date,
      close: latestData.close,
      adClose: latestData.adClose,
      open: latestData.open,
      high: latestData.high,
      low: latestData.low,
      formatted: formatPrice(latestData.close),
    })
  }

  return (
    <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800 space-y-3 sm:space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2 sm:gap-3">
        <input
          type="text"
          value={inputSymbol}
          onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Nhập mã cổ phiếu (VD: FPT, TCB, VNM)"
          className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-800 text-white text-sm sm:text-base rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 uppercase"
        />
        <button
          onClick={handleSearch}
          disabled={loading || isRefreshing}
          className="px-4 sm:px-8 py-2 sm:py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm sm:text-base rounded-lg transition-colors font-medium"
        >
          {loading ? 'Đang tải...' : 'Xem'}
        </button>
        {stockData.length > 0 && (
          <>
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              className="hidden sm:flex px-4 md:px-6 py-2 sm:py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium items-center gap-2"
              title="Làm mới dữ liệu (Auto-refresh mỗi 5 phút)"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span>{isRefreshing ? 'Đang làm mới...' : 'Làm mới'}</span>
            </button>
            <button
              onClick={toggleWatchlist}
              className={`hidden sm:flex px-4 md:px-6 py-2 sm:py-3 rounded-lg transition-colors font-medium items-center gap-2 ${
                isInWatchlist
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isInWatchlist ? 'Bỏ theo dõi' : 'Theo dõi mã này'}
            >
              <span>{isInWatchlist ? '⭐' : '☆'}</span>
              <span>{isInWatchlist ? 'Đang theo dõi' : 'Theo dõi'}</span>
            </button>
          </>
        )}
      </div>

      {/* Watchlist Quick Access */}
      {watchlist.length > 0 && (
        <div className="bg-gray-800/30 rounded-lg p-2 sm:p-3 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400 text-xs sm:text-sm font-semibold">⭐ Danh sách theo dõi:</span>
            <span className="text-gray-400 text-xs">({watchlist.length}/10)</span>
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {watchlist.map((sym) => (
              <button
                key={sym}
                onClick={() => switchToSymbol(sym)}
                disabled={loading || isRefreshing}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  sym === symbol
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Chart Container - Always render for chart initialization */}
      <div className="space-y-4">
        {/* Chart Controls - Show only when data is loaded */}
        {latestData && (
          <>
          {/* Data Date Indicator */}
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-2 sm:p-3 mb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 font-semibold">📅 Dữ liệu ngày:</span>
                <span className="text-white font-bold text-lg">
                  {new Date(latestData.date).toLocaleDateString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    weekday: 'long'
                  })}
                </span>
              </div>
              {(() => {
                const dataDate = new Date(latestData.date)
                dataDate.setHours(0, 0, 0, 0)
                const today = getVietnamDate()
                const diffDays = Math.floor((today.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24))

                if (diffDays === 0) {
                  return <span className="text-green-400 text-sm font-medium">✓ Dữ liệu hôm nay</span>
                } else if (diffDays === 1) {
                  return <span className="text-yellow-400 text-sm font-medium">⚠ Dữ liệu hôm qua</span>
                } else if (diffDays > 1) {
                  return <span className="text-orange-400 text-sm font-medium">⚠ Dữ liệu {diffDays} ngày trước</span>
                }
                return null
              })()}
            </div>
            {lastRefreshTime && (
              <div className="flex items-center gap-2 text-sm border-t border-blue-700/30 pt-2">
                <span className="text-blue-300">🔄 Cập nhật lần cuối:</span>
                <span className="text-gray-300">
                  {lastRefreshTime.toLocaleTimeString('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
                <span className="text-green-400 text-xs">(Auto-refresh mỗi 5 phút)</span>
              </div>
            )}
          </div>

          {/* Quick Info Panel */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {/* 1. Thị giá */}
            <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3">
              <div className="text-gray-400 text-xs mb-1">Thị giá</div>
              <div className={`text-xl font-bold ${
                latestData.close > latestData.open ? 'text-green-400' :
                latestData.close < latestData.open ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {formatPrice(latestData.close)}
              </div>
            </div>

            {/* 2. Thay đổi */}
            <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3">
              <div className="text-gray-400 text-xs mb-1">Thay đổi</div>
              <div className={`text-lg sm:text-xl font-bold ${formatChange(latestData.change).colorClass}`}>
                {formatChange(latestData.change).text}
                <span className={`text-xs sm:text-sm ml-1 ${formatChange(latestData.pctChange).colorClass}`}>
                  ({formatChange(latestData.pctChange).text}%)
                </span>
              </div>
            </div>

            {/* 3. Giá trần */}
            <div className="bg-purple-900/20 rounded-lg p-2 sm:p-3 border border-purple-700/30">
              <div className="text-purple-400 text-xs mb-1">Giá trần</div>
              <div className="text-lg sm:text-xl font-bold text-purple-300">
                {formatPrice(latestData.close * 1.07)}
              </div>
            </div>

            {/* 4. Giá sàn */}
            <div className="bg-cyan-900/20 rounded-lg p-2 sm:p-3 border border-cyan-700/30">
              <div className="text-cyan-400 text-xs mb-1">Giá sàn</div>
              <div className="text-lg sm:text-xl font-bold text-cyan-300">
                {formatPrice(latestData.close * 0.93)}
              </div>
            </div>

            {/* 5. Khối lượng */}
            <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3">
              <div className="text-gray-400 text-xs mb-1">Khối lượng</div>
              <div className="text-sm sm:text-lg font-bold text-white">
                {formatVolume(latestData.nmVolume)}
              </div>
            </div>

            {/* 6. Giá trị */}
            <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3">
              <div className="text-gray-400 text-xs mb-1">Giá trị</div>
              <div className="text-sm sm:text-lg font-bold text-white">
                {formatCurrency(latestData.nmValue)}
              </div>
            </div>
          </div>

          {/* Chart Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Timeframe Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-gray-400 text-xs sm:text-sm mr-1 sm:mr-2">Khung thời gian:</span>
              {(['1D', '1W', '1M'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${
                    timeframe === tf
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Chart Type Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 border-l border-gray-700 pl-2 sm:pl-4">
              <span className="text-gray-400 text-xs sm:text-sm mr-1 sm:mr-2">Loại biểu đồ:</span>
              <button
                onClick={() => setChartType('candlestick')}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${
                  chartType === 'candlestick'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🕯️ Nến
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${
                  chartType === 'line'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                📈 Đường
              </button>
            </div>
          </div>
          </>
        )}

        {/* Chart - Always render for initialization */}
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

          {/* Empty State */}
          {!loading && !stockData.length && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📊</div>
                <p className="text-gray-400 text-lg">Nhập mã cổ phiếu để xem biểu đồ</p>
              </div>
            </div>
          )}
        </div>

        {latestData && (
          <>
          {/* Short-term Technical Analysis */}
          {(bollingerBands.upper.length > 0 || pivotPoints) && (
            <div className="bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-lg p-2 sm:p-3 md:p-4 border border-cyan-700/30">
              <h4 className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-3">
                📊 Phân tích kỹ thuật ngắn hạn
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                {/* Current Price - First */}
                <div>
                  <span className="text-yellow-400 font-semibold">Giá hiện tại:</span>
                  <span className="ml-2 text-white font-bold">
                    {formatPrice(latestData.close)}
                  </span>
                </div>

                {/* Bollinger Bands */}
                {bollingerBands.upper.length > 0 && (
                  <>
                    <div>
                      <span className="text-purple-400 font-semibold">Hỗ trợ mạnh:</span>
                      <span className="ml-2 text-white font-bold">
                        {formatPrice(bollingerBands.lower[bollingerBands.lower.length - 1]?.value)}
                      </span>
                    </div>
                    <div>
                      <span className="text-cyan-400 font-semibold">Kháng cự:</span>
                      <span className="ml-2 text-white font-bold">
                        {formatPrice(bollingerBands.upper[bollingerBands.upper.length - 1]?.value)}
                      </span>
                    </div>
                  </>
                )}

                {/* T+ Signals */}
                {pivotPoints && (
                  <>
                    <div>
                      <span className="text-green-400 font-semibold">Buy T+:</span>
                      <span className="ml-2 text-white font-bold">{formatPrice(pivotPoints.S2)}</span>
                    </div>
                    <div>
                      <span className="text-red-400 font-semibold">Sell T+:</span>
                      <span className="ml-2 text-white font-bold">{formatPrice(pivotPoints.R3)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold">Pivot:</span>
                      <span className="ml-2 text-white font-bold">{formatPrice(pivotPoints.pivot)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* MA10 vs MA30 (BB Middle) Trend Analysis */}
              {movingAverages.ma10 !== null && bollingerBands.middle.length > 0 && (
                <div className="mt-4 pt-4 border-t border-cyan-700/30">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-blue-400 font-semibold">MA10:</span>
                      <span className="ml-2 text-white font-bold">
                        {formatPrice(movingAverages.ma10)}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-400 font-semibold">MA30:</span>
                      <span className="ml-2 text-white font-bold">
                        {formatPrice(bollingerBands.middle[bollingerBands.middle.length - 1]?.value)}
                      </span>
                    </div>
                    <div>
                      <span className={`font-semibold ${
                        movingAverages.ma10 > (bollingerBands.middle[bollingerBands.middle.length - 1]?.value || 0) ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {movingAverages.ma10 > (bollingerBands.middle[bollingerBands.middle.length - 1]?.value || 0)
                          ? '📈 Xu hướng ngắn hạn: Tăng giá'
                          : '📉 Xu hướng ngắn hạn: Giảm giá'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-600 rounded"></div>
              <span className="font-semibold text-purple-400">Biểu đồ sử dụng giá điều chỉnh (Adjusted Prices)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-500" style={{ borderTop: '2px solid #2962FF' }}></div>
              <span>Bollinger Bands</span>
            </div>
            {pivotPoints && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-green-500" style={{ borderTop: '2px dashed #22c55e' }}></div>
                  <span>Buy T+ - Pivot</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #ef4444' }}></div>
                  <span>Sell T+ - Pivot</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-lg">↑</span>
              <span className="font-semibold text-green-400">Buy (Golden Cross)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-lg">↓</span>
              <span className="font-semibold text-red-400">Sell (Death Cross)</span>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
})

// Helper functions for data aggregation
function aggregateWeekly(data: StockPriceData[]): StockPriceData[] {
  const weeks = new Map<string, StockPriceData[]>()

  data.forEach(item => {
    const date = new Date(item.date)
    const year = date.getFullYear()
    const week = getWeekNumber(date)
    const key = `${year}-W${week}`

    if (!weeks.has(key)) {
      weeks.set(key, [])
    }
    weeks.get(key)!.push(item)
  })

  return Array.from(weeks.values()).map(weekData => {
    const adOpen = weekData[0].adOpen
    const adClose = weekData[weekData.length - 1].adClose
    const adHigh = Math.max(...weekData.map(d => d.adHigh))
    const adLow = Math.min(...weekData.map(d => d.adLow))
    const nmVolume = weekData.reduce((sum, d) => sum + d.nmVolume, 0)
    const nmValue = weekData.reduce((sum, d) => sum + d.nmValue, 0)
    const adChange = adClose - adOpen
    const pctChange = (adChange / adOpen) * 100

    return {
      ...weekData[weekData.length - 1],
      adOpen,
      adHigh,
      adLow,
      adClose,
      nmVolume,
      nmValue,
      adChange,
      pctChange,
    }
  })
}

function aggregateMonthly(data: StockPriceData[]): StockPriceData[] {
  const months = new Map<string, StockPriceData[]>()

  data.forEach(item => {
    const date = new Date(item.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!months.has(key)) {
      months.set(key, [])
    }
    months.get(key)!.push(item)
  })

  return Array.from(months.values()).map(monthData => {
    const adOpen = monthData[0].adOpen
    const adClose = monthData[monthData.length - 1].adClose
    const adHigh = Math.max(...monthData.map(d => d.adHigh))
    const adLow = Math.min(...monthData.map(d => d.adLow))
    const nmVolume = monthData.reduce((sum, d) => sum + d.nmVolume, 0)
    const nmValue = monthData.reduce((sum, d) => sum + d.nmValue, 0)
    const adChange = adClose - adOpen
    const pctChange = (adChange / adOpen) * 100

    return {
      ...monthData[monthData.length - 1],
      adOpen,
      adHigh,
      adLow,
      adClose,
      nmVolume,
      nmValue,
      adChange,
      pctChange,
    }
  })
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

StockDetailsWidget.displayName = 'StockDetailsWidget'

export default StockDetailsWidget
