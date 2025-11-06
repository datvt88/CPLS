'use client'

import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react'
import { createChart, ColorType, Time, IChartApi, ISeriesApi } from 'lightweight-charts'
import type { CandlestickData, LineData } from 'lightweight-charts'
import { fetchStockPrices, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import type { StockPriceData, WoodiePivotPoints } from '@/types/vndirect'

interface StockDetailsWidgetProps {
  initialSymbol?: string
  onSymbolChange?: (symbol: string) => void
}

// Data cache to avoid redundant API calls
const dataCache = new Map<string, { data: StockPriceData[], timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

const StockDetailsWidget = memo(({ initialSymbol = 'VNM', onSymbolChange }: StockDetailsWidgetProps) => {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [inputSymbol, setInputSymbol] = useState(initialSymbol)
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M'>('1D')
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stockData, setStockData] = useState<StockPriceData[]>([])
  const [pivotPoints, setPivotPoints] = useState<WoodiePivotPoints | null>(null)

  // Sync with external symbol changes only when initialSymbol changes
  useEffect(() => {
    if (initialSymbol && initialSymbol !== inputSymbol) {
      setSymbol(initialSymbol)
      setInputSymbol(initialSymbol)
    }
  }, [initialSymbol])

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
  }>({
    candlestick: null,
    line: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
    s2Line: null,
    r3Line: null,
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

    chartRef.current = chart
    seriesRefs.current = {
      candlestick: candlestickSeries,
      line: lineSeries,
      bbUpper: bbUpperSeries,
      bbMiddle: bbMiddleSeries,
      bbLower: bbLowerSeries,
      s2Line: s2LineSeries,
      r3Line: r3LineSeries,
    }

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
  }, [])

  // Fetch stock data with caching
  const loadStockData = useCallback(async (stockSymbol: string) => {
    setLoading(true)
    setError(null)

    try {
      // Check cache first
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

      // Fetch fresh data - reduced from 270 to 150 days for better performance
      const response = await fetchStockPrices(stockSymbol, 150)

      if (!response.data || response.data.length === 0) {
        throw new Error('Không tìm thấy dữ liệu cho mã này')
      }

      // Sort by date ascending
      const sortedData = [...response.data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      // Cache the data
      dataCache.set(stockSymbol, { data: sortedData, timestamp: now })

      setStockData(sortedData)

      // Calculate pivot points from previous day (using adjusted prices)
      if (sortedData.length >= 2) {
        const prevDay = sortedData[sortedData.length - 2]
        const pivots = calculateWoodiePivotPoints(prevDay.adHigh, prevDay.adLow, prevDay.adClose)
        setPivotPoints(pivots)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data when symbol changes
  useEffect(() => {
    if (symbol) {
      loadStockData(symbol)
    }
  }, [symbol, loadStockData])

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
    if (!displayData.length) return { candleData: [], lineData: [], closePrices: [] }

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

    return { candleData, lineData, closePrices }
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
    } else {
      series.line?.setData(chartData.lineData)
      series.candlestick.setData([]) // Hide candlestick series
    }

    series.bbUpper?.setData(bollingerBands.upper)
    series.bbMiddle?.setData(bollingerBands.middle)
    series.bbLower?.setData(bollingerBands.lower)

    // Draw S2 and R3 lines for last 30 sessions
    series.s2Line?.setData(pivotLinesData.s2Data)
    series.r3Line?.setData(pivotLinesData.r3Data)

    chartRef.current?.timeScale().fitContent()
  }, [displayData, chartType, chartData, bollingerBands, pivotLinesData])

  const handleSearch = useCallback(() => {
    if (inputSymbol.trim()) {
      const newSymbol = inputSymbol.trim().toUpperCase()
      setSymbol(newSymbol)
      onSymbolChange?.(newSymbol)
    }
  }, [inputSymbol, onSymbolChange])

  const latestData = stockData[stockData.length - 1]

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <input
          type="text"
          value={inputSymbol}
          onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Nhập mã cổ phiếu (VD: FPT, TCB, VNM)"
          className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 uppercase"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
        >
          {loading ? 'Đang tải...' : 'Xem'}
        </button>
      </div>

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
          {/* Quick Info Panel */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Thị giá */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Thị giá</div>
              <div className={`text-xl font-bold ${
                latestData.close > latestData.open ? 'text-green-400' :
                latestData.close < latestData.open ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {latestData.close.toFixed(2)}
              </div>
            </div>

            {/* 2. Thay đổi */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Thay đổi</div>
              <div className={`text-xl font-bold ${
                latestData.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {latestData.change >= 0 ? '+' : ''}{latestData.change.toFixed(2)}
                <span className="text-sm ml-1">
                  ({latestData.pctChange >= 0 ? '+' : ''}{latestData.pctChange.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* 3. Giá trần */}
            <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-700/30">
              <div className="text-purple-400 text-xs mb-1">Giá trần</div>
              <div className="text-xl font-bold text-purple-300">
                {(latestData.close * 1.07).toFixed(2)}
              </div>
            </div>

            {/* 4. Giá sàn */}
            <div className="bg-cyan-900/20 rounded-lg p-3 border border-cyan-700/30">
              <div className="text-cyan-400 text-xs mb-1">Giá sàn</div>
              <div className="text-xl font-bold text-cyan-300">
                {(latestData.close * 0.93).toFixed(2)}
              </div>
            </div>

            {/* 5. Khối lượng */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Khối lượng</div>
              <div className="text-lg font-bold text-white">
                {(latestData.nmVolume / 1000000).toFixed(2)}M
              </div>
            </div>

            {/* 6. Giá trị */}
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Giá trị (tỷ VNĐ)</div>
              <div className="text-lg font-bold text-white">
                {(latestData.nmValue / 1000000000).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Chart Controls */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Timeframe Controls */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm mr-2">Khung thời gian:</span>
              {(['1D', '1W', '1M'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
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
            <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
              <span className="text-gray-400 text-sm mr-2">Loại biểu đồ:</span>
              <button
                onClick={() => setChartType('candlestick')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  chartType === 'candlestick'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                🕯️ Nến
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-4 py-2 rounded-lg transition-colors ${
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
            <div className="bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-lg p-4 border border-cyan-700/30">
              <h4 className="text-sm font-semibold text-white mb-3">
                📊 Phân tích kỹ thuật ngắn hạn
              </h4>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {/* Current Price - First */}
                <div>
                  <span className="text-yellow-400 font-semibold">Giá hiện tại:</span>
                  <span className="ml-2 text-white font-bold">
                    {latestData.close.toFixed(2)}
                  </span>
                </div>

                {/* Bollinger Bands */}
                {bollingerBands.upper.length > 0 && (
                  <>
                    <div>
                      <span className="text-purple-400 font-semibold">Hỗ trợ mạnh:</span>
                      <span className="ml-2 text-white font-bold">
                        {bollingerBands.lower[bollingerBands.lower.length - 1]?.value.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-cyan-400 font-semibold">Kháng cự mạnh:</span>
                      <span className="ml-2 text-white font-bold">
                        {bollingerBands.upper[bollingerBands.upper.length - 1]?.value.toFixed(2) || 'N/A'}
                      </span>
                    </div>
                  </>
                )}

                {/* T+ Signals */}
                {pivotPoints && (
                  <>
                    <div>
                      <span className="text-green-400 font-semibold">Buy T+:</span>
                      <span className="ml-2 text-white font-bold">{pivotPoints.S2}</span>
                    </div>
                    <div>
                      <span className="text-red-400 font-semibold">Sell T+:</span>
                      <span className="ml-2 text-white font-bold">{pivotPoints.R3}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-semibold">Pivot:</span>
                      <span className="ml-2 text-white font-bold">{pivotPoints.pivot}</span>
                    </div>
                  </>
                )}
              </div>
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
                  <span>Buy T+ - theo Pivot</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #ef4444' }}></div>
                  <span>Sell T+ - theo Pivot</span>
                </div>
              </>
            )}
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
