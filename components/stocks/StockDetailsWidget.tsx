'use client'
import { useEffect, useState, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData } from 'lightweight-charts'

interface StockPrice {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface BollingerBands {
  upper: number
  middle: number
  lower: number
}

interface WoodiePivot {
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
}

type TimeFrame = '1D' | '1W' | '1M'

export default function StockDetailsWidget({ stockCode }: { stockCode: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('1D')
  const [stockData, setStockData] = useState<StockPrice[]>([])
  const [pivotPoints, setPivotPoints] = useState<WoodiePivot | null>(null)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const upperBandSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const middleBandSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lowerBandSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  // Calculate Bollinger Bands (30, 3)
  const calculateBollingerBands = (data: StockPrice[]): BollingerBands[] => {
    const period = 30
    const stdDev = 3
    const bands: BollingerBands[] = []

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        bands.push({ upper: 0, middle: 0, lower: 0 })
        continue
      }

      const slice = data.slice(i - period + 1, i + 1)
      const closes = slice.map(d => d.close)
      const sma = closes.reduce((a, b) => a + b, 0) / period

      const squaredDiffs = closes.map(c => Math.pow(c - sma, 2))
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period
      const stdDeviation = Math.sqrt(variance)

      bands.push({
        middle: sma,
        upper: sma + stdDev * stdDeviation,
        lower: sma - stdDev * stdDeviation,
      })
    }

    return bands
  }

  // Calculate Woodie Pivot Points
  const calculateWoodiePivot = (data: StockPrice[]): WoodiePivot | null => {
    if (data.length === 0) return null

    const latest = data[data.length - 1]
    if (!latest) return null

    const pivot = (latest.high + latest.low + 2 * latest.close) / 4

    const r1 = 2 * pivot - latest.low
    const r2 = pivot + latest.high - latest.low
    const r3 = r1 + latest.high - latest.low

    const s1 = 2 * pivot - latest.high
    const s2 = pivot - latest.high + latest.low
    const s3 = s1 - latest.high + latest.low

    return { pivot, r1, r2, r3, s1, s2, s3 }
  }

  const fetchStockData = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${stockCode}&size=270`
      )

      if (!response.ok) throw new Error('Không thể tải dữ liệu')

      const data = await response.json()

      if (data.data && Array.isArray(data.data)) {
        const prices: StockPrice[] = data.data.map((item: any) => ({
          date: item.date,
          open: item.open || 0,
          high: item.high || 0,
          low: item.low || 0,
          close: item.close || 0,
          volume: item.nmVolume || 0,
        }))

        setStockData(prices)
        setPivotPoints(calculateWoodiePivot(prices))
        setError(null)
      } else {
        setError('Không tìm thấy dữ liệu cho mã cổ phiếu này')
      }
    } catch (err) {
      setError('Không thể tải dữ liệu cổ phiếu')
      console.error('Error fetching stock data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStockData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockCode])

  useEffect(() => {
    if (!chartContainerRef.current || stockData.length === 0) return

    // Clear previous chart
    if (chartRef.current) {
      chartRef.current.remove()
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      timeScale: {
        borderColor: '#4b5563',
      },
      rightPriceScale: {
        borderColor: '#4b5563',
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
    candlestickSeriesRef.current = candlestickSeries

    // Prepare candlestick data
    const candleData: CandlestickData[] = stockData.map(item => ({
      time: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    }))

    candlestickSeries.setData(candleData)

    // Calculate and add Bollinger Bands
    const bands = calculateBollingerBands(stockData)

    const upperBandData: LineData[] = []
    const middleBandData: LineData[] = []
    const lowerBandData: LineData[] = []

    stockData.forEach((item, i) => {
      if (bands[i] && bands[i].middle > 0) {
        upperBandData.push({ time: item.date, value: bands[i].upper })
        middleBandData.push({ time: item.date, value: bands[i].middle })
        lowerBandData.push({ time: item.date, value: bands[i].lower })
      }
    })

    const upperBandSeries = chart.addLineSeries({
      color: '#ef4444',
      lineWidth: 2,
      title: 'Upper BB',
    })
    upperBandSeriesRef.current = upperBandSeries
    upperBandSeries.setData(upperBandData)

    const middleBandSeries = chart.addLineSeries({
      color: '#fbbf24',
      lineWidth: 2,
      title: 'Middle BB',
    })
    middleBandSeriesRef.current = middleBandSeries
    middleBandSeries.setData(middleBandData)

    const lowerBandSeries = chart.addLineSeries({
      color: '#22c55e',
      lineWidth: 2,
      title: 'Lower BB',
    })
    lowerBandSeriesRef.current = lowerBandSeries
    lowerBandSeries.setData(lowerBandData)

    chart.timeScale().fitContent()

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
      }
    }
  }, [stockData, timeFrame])

  if (loading) {
    return (
      <div className="bg-panel border border-gray-800 rounded-lg p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-panel border border-gray-800 rounded-lg p-8">
        <div className="text-center py-8 text-red-400">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  const latestPrice = stockData.length > 0 ? stockData[stockData.length - 1] : null

  return (
    <div className="bg-panel border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{stockCode}</h2>
            {latestPrice && (
              <div className="flex items-center gap-4 mt-2">
                <span className="text-3xl font-bold text-green-500">
                  {latestPrice.close.toFixed(2)}
                </span>
                <span className="text-sm text-muted">
                  Cao: {latestPrice.high.toFixed(2)} | Thấp: {latestPrice.low.toFixed(2)}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeFrame('1D')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                timeFrame === '1D'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              1 Ngày
            </button>
            <button
              onClick={() => setTimeFrame('1W')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                timeFrame === '1W'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              1 Tuần
            </button>
            <button
              onClick={() => setTimeFrame('1M')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                timeFrame === '1M'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              1 Tháng
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div ref={chartContainerRef} className="w-full" />

        {/* Indicators Legend */}
        <div className="mt-4 p-3 bg-gray-900 rounded-lg">
          <div className="text-sm font-semibold mb-2">Chỉ báo kỹ thuật:</div>
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Upper BB (Kháng cự mạnh)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>Middle BB (30)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Lower BB (Hỗ trợ mạnh)</span>
            </div>
          </div>
        </div>

        {/* Woodie Pivot Points */}
        {pivotPoints && (
          <div className="mt-4 p-4 bg-gray-900 rounded-lg">
            <div className="text-sm font-semibold mb-3">Woodie Pivot Points (Tín hiệu T+)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xs text-muted">Pivot</div>
                <div className="text-lg font-bold text-yellow-500">{pivotPoints.pivot.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted">R3 (Kháng cự)</div>
                <div className="text-lg font-bold text-red-500">{pivotPoints.r3.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted">R2</div>
                <div className="text-base font-semibold text-red-400">{pivotPoints.r2.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted">R1</div>
                <div className="text-base text-red-300">{pivotPoints.r1.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted">S1</div>
                <div className="text-base text-green-300">{pivotPoints.s1.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted">S2</div>
                <div className="text-base font-semibold text-green-400">{pivotPoints.s2.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted">S3 (Hỗ trợ)</div>
                <div className="text-lg font-bold text-green-500">{pivotPoints.s3.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
