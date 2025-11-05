'use client'

import { useState, useEffect, useRef, memo, useMemo } from 'react'
import { createChart, ColorType, Time, IChartApi, ISeriesApi } from 'lightweight-charts'
import type { CandlestickData, LineData } from 'lightweight-charts'
import { fetchStockPrices, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import type { StockPriceData, WoodiePivotPoints } from '@/types/vndirect'

interface StockDetailsWidgetProps {
  initialSymbol?: string
  onSymbolChange?: (symbol: string) => void
}

const StockDetailsWidget = memo(({ initialSymbol = 'VNM', onSymbolChange }: StockDetailsWidgetProps) => {
  const [symbol, setSymbol] = useState(initialSymbol)
  const [inputSymbol, setInputSymbol] = useState(initialSymbol)
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M'>('1D')
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stockData, setStockData] = useState<StockPriceData[]>([])
  const [pivotPoints, setPivotPoints] = useState<WoodiePivotPoints | null>(null)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRefs = useRef<{
    candlestick: ISeriesApi<'Candlestick'> | null
    line: ISeriesApi<'Line'> | null
    bbUpper: ISeriesApi<'Line'> | null
    bbMiddle: ISeriesApi<'Line'> | null
    bbLower: ISeriesApi<'Line'> | null
  }>({
    candlestick: null,
    line: null,
    bbUpper: null,
    bbMiddle: null,
    bbLower: null,
  })

  // Initialize chart
  useEffect(() => {
    console.log('🚀 Chart initialization effect running...')

    if (!chartContainerRef.current) {
      console.log('❌ Chart container ref not available')
      return
    }

    console.log('✅ Chart container ref available, creating chart...')

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
      color: '#2962FF',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const bbUpperSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const bbMiddleSeries = chart.addLineSeries({
      color: '#FF6D00',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const bbLowerSeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chartRef.current = chart
    seriesRefs.current = {
      candlestick: candlestickSeries,
      line: lineSeries,
      bbUpper: bbUpperSeries,
      bbMiddle: bbMiddleSeries,
      bbLower: bbLowerSeries,
    }

    console.log('✅ Chart and all series created successfully')

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

  // Fetch stock data
  const loadStockData = async (stockSymbol: string) => {
    setLoading(true)
    setError(null)

    try {
      console.log('🔍 Fetching stock data for:', stockSymbol)
      const response = await fetchStockPrices(stockSymbol, 270)

      console.log('📦 API Response:', response)

      if (!response.data || response.data.length === 0) {
        throw new Error('Không tìm thấy dữ liệu cho mã này')
      }

      // Sort by date ascending
      const sortedData = [...response.data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      console.log('✅ Data sorted:', {
        total: sortedData.length,
        first: sortedData[0],
        last: sortedData[sortedData.length - 1]
      })

      setStockData(sortedData)

      // Calculate pivot points from previous day
      if (sortedData.length >= 2) {
        const prevDay = sortedData[sortedData.length - 2]
        const pivots = calculateWoodiePivotPoints(prevDay.high, prevDay.low, prevDay.close)
        console.log('📊 Pivot Points:', pivots)
        setPivotPoints(pivots)
      }
    } catch (err) {
      console.error('❌ Error loading stock data:', err)
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  // Load data when symbol changes
  useEffect(() => {
    if (symbol) {
      loadStockData(symbol)
    }
  }, [symbol])

  // Memoize aggregated data based on timeframe
  const displayData = useMemo(() => {
    if (!stockData.length) return []

    if (timeframe === '1W') {
      console.log('📅 Aggregating to weekly...')
      return aggregateWeekly(stockData)
    } else if (timeframe === '1M') {
      console.log('📅 Aggregating to monthly...')
      return aggregateMonthly(stockData)
    }

    return stockData
  }, [stockData, timeframe])

  // Memoize chart data
  const chartData = useMemo(() => {
    if (!displayData.length) return { candleData: [], lineData: [], closePrices: [] }

    const candleData: CandlestickData[] = displayData.map(d => ({
      time: d.date as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))

    const lineData: LineData[] = displayData.map(d => ({
      time: d.date as Time,
      value: d.close,
    }))

    const closePrices = displayData.map(d => d.close)

    return { candleData, lineData, closePrices }
  }, [displayData])

  // Memoize Bollinger Bands
  const bollingerBands = useMemo(() => {
    if (!chartData.closePrices.length) return { upper: [], middle: [], lower: [] }

    const bb = calculateBollingerBands(chartData.closePrices, 20, 2)

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

  // Update chart when data or settings change
  useEffect(() => {
    console.log('🎨 Chart update effect triggered:', {
      hasData: !!displayData.length,
      dataLength: displayData.length,
      hasSeries: !!seriesRefs.current.candlestick,
      chartType
    })

    if (!displayData.length || !seriesRefs.current.candlestick) {
      console.log('⚠️ Cannot update chart - missing data or series')
      return
    }

    const series = seriesRefs.current

    console.log('📊 Display data prepared:', {
      count: displayData.length,
      sample: displayData[0]
    })

    // Show/hide series based on chart type
    if (chartType === 'candlestick') {
      console.log('🕯️ Setting candlestick data:', chartData.candleData.length, 'candles')
      series.candlestick.setData(chartData.candleData)
      series.line?.setData([]) // Hide line series
    } else {
      console.log('📈 Setting line data:', chartData.lineData.length, 'points')
      series.line?.setData(chartData.lineData)
      series.candlestick.setData([]) // Hide candlestick series
    }

    console.log('📈 Setting Bollinger Bands:', {
      upper: bollingerBands.upper.length,
      middle: bollingerBands.middle.length,
      lower: bollingerBands.lower.length
    })

    series.bbUpper?.setData(bollingerBands.upper)
    series.bbMiddle?.setData(bollingerBands.middle)
    series.bbLower?.setData(bollingerBands.lower)

    chartRef.current?.timeScale().fitContent()
    console.log('✅ Chart update complete!')
  }, [displayData, chartType, chartData, bollingerBands])

  const handleSearch = () => {
    if (inputSymbol.trim()) {
      const newSymbol = inputSymbol.trim().toUpperCase()
      setSymbol(newSymbol)
      onSymbolChange?.(newSymbol)
    }
  }

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
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Thị giá</div>
              <div className={`text-xl font-bold ${
                latestData.close > latestData.open ? 'text-green-400' :
                latestData.close < latestData.open ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {latestData.close.toFixed(2)}
              </div>
            </div>

            <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-700/30">
              <div className="text-purple-400 text-xs mb-1">Giá trần</div>
              <div className="text-xl font-bold text-purple-300">
                {(latestData.close * 1.07).toFixed(2)}
              </div>
            </div>

            <div className="bg-cyan-900/20 rounded-lg p-3 border border-cyan-700/30">
              <div className="text-cyan-400 text-xs mb-1">Giá sàn</div>
              <div className="text-xl font-bold text-cyan-300">
                {(latestData.close * 0.93).toFixed(2)}
              </div>
            </div>

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

            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="text-gray-400 text-xs mb-1">Khối lượng</div>
              <div className="text-lg font-bold text-white">
                {(latestData.nmVolume / 1000000).toFixed(2)}M
              </div>
            </div>

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
          {/* Woodie Pivot Points - T+ Signals */}
          {pivotPoints && (
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-4 border border-blue-700/30">
              <h4 className="text-sm font-semibold text-white mb-3">
                📈 Tín hiệu Giao dịch T+ (Woodie Pivot Points)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-green-400 font-semibold">Buy T+ (S3):</span>
                  <span className="ml-2 text-white font-bold">{pivotPoints.S3}</span>
                  <p className="text-xs text-gray-400 mt-1">Mức hỗ trợ mạnh</p>
                </div>
                <div>
                  <span className="text-green-400 font-semibold">S2:</span>
                  <span className="ml-2 text-white font-bold">{pivotPoints.S2}</span>
                </div>
                <div>
                  <span className="text-red-400 font-semibold">R2:</span>
                  <span className="ml-2 text-white font-bold">{pivotPoints.R2}</span>
                </div>
                <div>
                  <span className="text-red-400 font-semibold">Sell T+ (R3):</span>
                  <span className="ml-2 text-white font-bold">{pivotPoints.R3}</span>
                  <p className="text-xs text-gray-400 mt-1">Mức kháng cự mạnh</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-400">
                <strong>Pivot Point:</strong> {pivotPoints.pivot} |
                <strong className="ml-2">R1:</strong> {pivotPoints.R1} |
                <strong className="ml-2">S1:</strong> {pivotPoints.S1}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-500" style={{ borderTop: '2px dashed #2962FF' }}></div>
              <span>Bollinger Bands</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-orange-500" style={{ borderTop: '2px dashed #FF6D00' }}></div>
              <span>BB Middle (MA-20)</span>
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
    const open = weekData[0].open
    const close = weekData[weekData.length - 1].close
    const high = Math.max(...weekData.map(d => d.high))
    const low = Math.min(...weekData.map(d => d.low))
    const nmVolume = weekData.reduce((sum, d) => sum + d.nmVolume, 0)
    const nmValue = weekData.reduce((sum, d) => sum + d.nmValue, 0)
    const change = close - open
    const pctChange = (change / open) * 100

    return {
      ...weekData[weekData.length - 1],
      open,
      high,
      low,
      close,
      nmVolume,
      nmValue,
      change,
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
    const open = monthData[0].open
    const close = monthData[monthData.length - 1].close
    const high = Math.max(...monthData.map(d => d.high))
    const low = Math.min(...monthData.map(d => d.low))
    const nmVolume = monthData.reduce((sum, d) => sum + d.nmVolume, 0)
    const nmValue = monthData.reduce((sum, d) => sum + d.nmValue, 0)
    const change = close - open
    const pctChange = (change / open) * 100

    return {
      ...monthData[monthData.length - 1],
      open,
      high,
      low,
      close,
      nmVolume,
      nmValue,
      change,
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
