'use client'

import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Timeframe, StockPriceData } from '@/types/stock'
import {
  generateMockStockData,
  mockVietnameseStocks,
  getStockBySymbol,
} from '@/utils/mockStockData'
import { calculateWoodiePivotPoints } from '@/components/LightweightChart'

// Helper function to get ISO week number
function getISOWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Helper function to aggregate OHLC data
function aggregateGroup(group: StockPriceData[]): StockPriceData {
  if (group.length === 0) throw new Error('Empty group')
  if (group.length === 1) return group[0]

  const open = group[0].open
  const close = group[group.length - 1].close
  const high = Math.max(...group.map(d => d.high))
  const low = Math.min(...group.map(d => d.low))
  const nmVolume = group.reduce((sum, d) => sum + d.nmVolume, 0)
  const date = group[group.length - 1].date // Use last date in group

  return {
    date,
    open: Number(open.toFixed(2)),
    high: Number(high.toFixed(2)),
    low: Number(low.toFixed(2)),
    close: Number(close.toFixed(2)),
    nmVolume,
  }
}

// Dynamic import to avoid SSR issues with lightweight-charts
const LightweightChart = dynamic(() => import('@/components/LightweightChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full flex items-center justify-center bg-[--panel] rounded-xl border border-gray-800">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-400">Đang tải biểu đồ...</p>
      </div>
    </div>
  ),
})

export default function StocksPage() {
  const [stockSymbol, setStockSymbol] = useState('VNM')
  const [timeframe, setTimeframe] = useState<Timeframe>('1d')
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick')
  const [dataRange, setDataRange] = useState<'6m' | '1y' | '3y'>('3y') // Default to 3 years

  const stockInfo = useMemo(() => {
    return getStockBySymbol(stockSymbol)
  }, [stockSymbol])

  // Generate mock data for selected stock with correct reference price (3 years = 1095 days)
  const rawHistoricalData = useMemo(() => {
    if (!stockInfo) return []
    return generateMockStockData(1095, stockInfo.referencePrice, stockInfo.lastPrice)
  }, [stockSymbol, stockInfo])

  // Aggregate data based on timeframe
  const historicalData = useMemo(() => {
    if (rawHistoricalData.length === 0) {
      return []
    }

    if (timeframe === '1d') {
      return rawHistoricalData
    }

    // Aggregate for weekly or monthly
    const aggregated: StockPriceData[] = []
    const sortedData = [...rawHistoricalData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    let currentGroup: StockPriceData[] = []
    let currentPeriodKey = ''

    sortedData.forEach((dataPoint, index) => {
      const date = new Date(dataPoint.date)
      let periodKey = ''

      if (timeframe === '1w') {
        // Group by week (ISO week number)
        const week = getISOWeek(date)
        const year = date.getFullYear()
        periodKey = `${year}-W${week}`
      } else if (timeframe === '1m') {
        // Group by month
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      }

      // Start new group or add to current group
      if (currentPeriodKey === '') {
        // First item
        currentGroup = [dataPoint]
        currentPeriodKey = periodKey
      } else if (periodKey !== currentPeriodKey) {
        // Period changed, save current group and start new one
        if (currentGroup.length > 0) {
          aggregated.push(aggregateGroup(currentGroup))
        }
        currentGroup = [dataPoint]
        currentPeriodKey = periodKey
      } else {
        // Same period, add to current group
        currentGroup.push(dataPoint)
      }

      // Handle last group
      if (index === sortedData.length - 1 && currentGroup.length > 0) {
        aggregated.push(aggregateGroup(currentGroup))
      }
    })

    return aggregated
  }, [rawHistoricalData, timeframe])

  // Display data based on selected range
  const displayData = useMemo(() => {
    if (historicalData.length === 0) return []

    // Calculate limit based on data range and timeframe
    let limitDays: number

    if (dataRange === '6m') {
      limitDays = timeframe === '1d' ? 180 : timeframe === '1w' ? 26 : 6
    } else if (dataRange === '1y') {
      limitDays = timeframe === '1d' ? 365 : timeframe === '1w' ? 52 : 12
    } else { // 3y
      // Show all data for 3 years
      return historicalData
    }

    // Take last N data points
    return historicalData.slice(-limitDays)
  }, [historicalData, timeframe, dataRange])

  // Calculate pivot points
  const pivotPoints = useMemo(() => {
    return calculateWoodiePivotPoints(displayData)
  }, [displayData])

  // Memoized callbacks for better performance
  const handleStockSymbolChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStockSymbol(e.target.value.toUpperCase())
  }, [])

  const handleScrollToChart = useCallback(() => {
    const technicalSection = document.getElementById('technical-analysis')
    technicalSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const chartSection = document.querySelector('.bg-\\[--panel\\].rounded-xl.p-6.border.border-gray-800:has(#technical-analysis)')
        || document.getElementById('technical-analysis')
      chartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">Cổ phiếu</h1>
        <p className="text-[--muted]">Theo dõi và phân tích biểu đồ cổ phiếu Việt Nam</p>
      </div>

      {/* Stock Symbol Input */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <label htmlFor="stock-symbol" className="block text-sm font-medium text-gray-400 mb-2">
          Nhập mã cổ phiếu
        </label>
        <div className="flex gap-3">
          <input
            id="stock-symbol"
            type="text"
            value={stockSymbol}
            onChange={handleStockSymbolChange}
            onKeyDown={handleKeyDown}
            placeholder="VD: VNM, HPG, VIC, VHM..."
            className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 uppercase"
          />
          <button
            onClick={handleScrollToChart}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium whitespace-nowrap"
          >
            📊 Xem PTKT
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Nhập mã cổ phiếu Việt Nam (VD: VNM, HPG, VIC, VHM, FPT, TCB, MSN, VRE)
        </p>
      </div>

      {/* Stock Detailed Info Card */}
      {stockInfo && (
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-white mb-1">
              {stockInfo.symbol} - {stockInfo.name}
            </h2>
            <p className="text-[--muted] text-sm">Cổ phiếu niêm yết trên HOSE/HNX</p>
          </div>

          {/* Price Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {/* Current Price */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-[--muted] text-xs mb-1">Giá hiện tại</div>
              <div className="text-2xl font-bold text-white">{stockInfo.lastPrice.toFixed(2)}</div>
              <div
                className={`text-sm font-semibold ${
                  stockInfo.change >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {stockInfo.change >= 0 ? '+' : ''}
                {stockInfo.change.toFixed(2)} ({stockInfo.changePercent >= 0 ? '+' : ''}
                {stockInfo.changePercent.toFixed(2)}%)
              </div>
            </div>

            {/* Reference Price */}
            <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-700/30">
              <div className="text-yellow-400 text-xs mb-1">Giá tham chiếu</div>
              <div className="text-2xl font-bold text-yellow-300">
                {stockInfo.referencePrice.toFixed(2)}
              </div>
              <div className="text-xs text-yellow-400/70">Giá đóng cửa phiên trước</div>
            </div>

            {/* Ceiling Price */}
            <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30">
              <div className="text-purple-400 text-xs mb-1">Giá trần</div>
              <div className="text-2xl font-bold text-purple-300">
                {stockInfo.ceilingPrice.toFixed(2)}
              </div>
              <div className="text-xs text-purple-400/70">+7%</div>
            </div>

            {/* Floor Price */}
            <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-700/30">
              <div className="text-cyan-400 text-xs mb-1">Giá sàn</div>
              <div className="text-2xl font-bold text-cyan-300">
                {stockInfo.floorPrice.toFixed(2)}
              </div>
              <div className="text-xs text-cyan-400/70">-7%</div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-700">
            <div>
              <span className="text-[--muted] text-sm">Khối lượng giao dịch:</span>
              <span className="ml-2 text-white font-semibold">
                {stockInfo.volume.toLocaleString()}
              </span>
            </div>

            {pivotPoints && (
              <>
                <div>
                  <span className="text-[--muted] text-sm">Woodie R3 (Kháng cự):</span>
                  <span className="ml-2 text-red-400 font-semibold">
                    {pivotPoints.R3.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[--muted] text-sm">Woodie S3 (Hỗ trợ):</span>
                  <span className="ml-2 text-green-400 font-semibold">
                    {pivotPoints.S3.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chart Controls */}
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="flex flex-col gap-4">
          {/* First row: Timeframe and Data Range */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Timeframe Selection */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[--muted] mr-2">Khung thời gian:</span>
              {(['1d', '1w', '1m'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    timeframe === tf
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {tf === '1d' ? 'Ngày' : tf === '1w' ? 'Tuần' : 'Tháng'}
                </button>
              ))}
            </div>

            {/* Data Range Selection */}
            <div className="flex items-center gap-2 flex-wrap md:ml-auto">
              <span className="text-[--muted] mr-2">Khoảng thời gian:</span>
              {[
                { value: '6m' as const, label: '6 tháng' },
                { value: '1y' as const, label: '1 năm' },
                { value: '3y' as const, label: '3 năm' }
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDataRange(range.value)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    dataRange === range.value
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Second row: Chart Type */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[--muted] mr-2">Loại biểu đồ:</span>
            <button
              onClick={() => setChartType('candlestick')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                chartType === 'candlestick'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📊 Nến
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                chartType === 'line'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              📈 Line
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            {chartType === 'candlestick' ? 'Biểu đồ nến' : 'Biểu đồ đường'} - {stockSymbol}
          </h3>
          <div className="text-sm text-[--muted]">
            {displayData.length} điểm dữ liệu
            {timeframe === '1d' ? ' (ngày)' : timeframe === '1w' ? ' (tuần)' : ' (tháng)'} -
            {dataRange === '6m' ? ' 6 tháng gần nhất' : dataRange === '1y' ? ' 1 năm gần nhất' : ' 3 năm'}
          </div>
        </div>

        {stockInfo && displayData.length > 0 ? (
          <LightweightChart
            historicalData={displayData}
            timeframe={timeframe}
            pivotPoints={pivotPoints}
            chartType={chartType}
          />
        ) : (
          <div className="h-[500px] w-full flex items-center justify-center bg-gray-800/30 rounded-lg">
            <div className="text-center text-gray-400">
              <p className="text-lg">Không có dữ liệu để hiển thị</p>
              <p className="text-sm mt-2">Vui lòng thử lại hoặc chọn mã cổ phiếu khác</p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-red-500" style={{ borderTop: '2px dashed #ef5350' }}></div>
            <span className="text-[--muted]">
              <strong className="text-red-400">R3</strong> - Kháng cự (1 tháng cuối)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-0.5 bg-green-500" style={{ borderTop: '2px dashed #26a69a' }}></div>
            <span className="text-[--muted]">
              <strong className="text-green-400">S3</strong> - Hỗ trợ (1 tháng cuối)
            </span>
          </div>
        </div>
      </div>

      {/* Technical Analysis Guide */}
      <div id="technical-analysis" className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-700/30">
        <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
          📊 Phân tích kỹ thuật - Woodie Pivot Points
        </h3>
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <p className="font-semibold text-white mb-2">Cách sử dụng R3 và S3:</p>
            <ul className="list-disc list-inside space-y-2 text-[--muted]">
              <li>
                <strong className="text-red-400">R3 (Resistance/Kháng cự):</strong> Mức giá khó vượt qua. Khi giá chạm R3, thường có áp lực bán mạnh, giá có xu hướng quay đầu giảm.
              </li>
              <li>
                <strong className="text-green-400">S3 (Support/Hỗ trợ):</strong> Mức giá khó thủng qua. Khi giá chạm S3, thường có áp lực mua mạnh, giá có xu hướng bật lên.
              </li>
              <li>
                <strong className="text-yellow-400">Phá vỡ R3:</strong> Nếu giá vượt qua R3 với khối lượng lớn, đây là tín hiệu xu hướng tăng mạnh (bullish).
              </li>
              <li>
                <strong className="text-orange-400">Phá vỡ S3:</strong> Nếu giá thủng S3 với khối lượng lớn, đây là tín hiệu xu hướng giảm mạnh (bearish).
              </li>
            </ul>
          </div>
          <div className="pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              <strong>Lưu ý:</strong> Nên kết hợp thêm các chỉ báo khác và phân tích cơ bản trước khi đưa ra quyết định giao dịch.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-3">⚠️ Lưu ý quan trọng</h3>
        <p className="text-[--muted] text-sm leading-relaxed">
          Đây là dữ liệu mô phỏng (mock data) chỉ phục vụ mục đích demo và học tập. Để sử
          dụng dữ liệu thực tế, vui lòng tích hợp với các API chứng khoán như{' '}
          <strong className="text-white">SSI iBoard</strong>,{' '}
          <strong className="text-white">VPS SmartOne</strong>, hoặc các nhà cung cấp dữ
          liệu tài chính khác. Không nên sử dụng dữ liệu này để ra quyết định đầu tư thực
          tế.
        </p>
      </div>
    </div>
  )
}
