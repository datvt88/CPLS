'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Timeframe } from '@/types/stock'
import {
  generateMockStockData,
  mockVietnameseStocks,
  getStockBySymbol,
} from '@/utils/mockStockData'
import { calculateWoodiePivotPoints } from '@/components/LightweightChart'

// Dynamic import to avoid SSR issues with lightweight-charts
const LightweightChart = dynamic(() => import('@/components/LightweightChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[450px] w-full flex items-center justify-center bg-[--panel] rounded-xl border border-gray-800">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-400">Đang tải biểu đồ...</p>
      </div>
    </div>
  ),
})

export default function StocksPage() {
  const [selectedStock, setSelectedStock] = useState('VNM')
  const [timeframe, setTimeframe] = useState<Timeframe>('1d')

  // Generate mock data for selected stock
  const historicalData = useMemo(() => {
    return generateMockStockData(180)
  }, [selectedStock])

  // Calculate pivot points
  const pivotPoints = useMemo(() => {
    return calculateWoodiePivotPoints(historicalData)
  }, [historicalData])

  const stockInfo = getStockBySymbol(selectedStock)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">Cổ phiếu</h1>
        <p className="text-[--muted]">Theo dõi và phân tích biểu đồ cổ phiếu</p>
      </div>

      {/* Stock Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mockVietnameseStocks.map((stock) => (
          <button
            key={stock.symbol}
            onClick={() => setSelectedStock(stock.symbol)}
            className={`p-4 rounded-xl border transition-all ${
              selectedStock === stock.symbol
                ? 'bg-purple-600 border-purple-500 text-white'
                : 'bg-[--panel] border-gray-800 text-gray-300 hover:border-purple-500'
            }`}
          >
            <div className="font-bold text-lg">{stock.symbol}</div>
            <div className="text-sm opacity-75 truncate">{stock.name}</div>
            <div className="text-xs mt-2">
              <span className={stock.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                {stock.change >= 0 ? '+' : ''}
                {stock.changePercent.toFixed(2)}%
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Stock Info Card */}
      {stockInfo && (
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {stockInfo.symbol} - {stockInfo.name}
              </h2>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-3xl font-bold text-white">
                  {stockInfo.lastPrice.toFixed(2)}
                </span>
                <span
                  className={`text-lg font-semibold ${
                    stockInfo.change >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {stockInfo.change >= 0 ? '+' : ''}
                  {stockInfo.change.toFixed(2)} ({stockInfo.changePercent >= 0 ? '+' : ''}
                  {stockInfo.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[--muted] text-sm">Khối lượng</div>
              <div className="text-white text-xl font-semibold">
                {stockInfo.volume.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Pivot Points */}
          {pivotPoints && (
            <div className="mt-4 pt-4 border-t border-gray-800 flex gap-6">
              <div>
                <span className="text-[--muted] text-sm">Woodie R3:</span>
                <span className="ml-2 text-red-400 font-semibold">
                  {pivotPoints.R3.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[--muted] text-sm">Woodie S3:</span>
                <span className="ml-2 text-green-400 font-semibold">
                  {pivotPoints.S3.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeframe Selection */}
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="flex gap-2">
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
      </div>

      {/* Chart */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-xl font-semibold text-white mb-4">
          Biểu đồ giá - {selectedStock}
        </h3>
        <LightweightChart
          historicalData={historicalData}
          timeframe={timeframe}
          pivotPoints={pivotPoints}
        />
        <div className="mt-4 text-sm text-[--muted]">
          <p>
            <strong className="text-green-400">Đường xanh:</strong> Bollinger Bands (Hỗ
            trợ/Kháng cự)
          </p>
          <p>
            <strong className="text-yellow-400">Đường vàng:</strong> Bollinger Middle (SMA)
          </p>
          <p>
            <strong className="text-red-400">Đường đỏ đứt nét:</strong> Woodie R3
            (Resistance)
          </p>
          <p>
            <strong className="text-green-400">Đường xanh đứt nét:</strong> Woodie S3
            (Support)
          </p>
        </div>
      </div>

      {/* Additional Info */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-xl font-semibold text-white mb-3">Chú ý</h3>
        <p className="text-[--muted] text-sm">
          Đây là dữ liệu mô phỏng (mock data) cho mục đích demo. Để sử dụng dữ liệu thực,
          vui lòng tích hợp với API chứng khoán như SSI, VPS hoặc các nhà cung cấp dữ
          liệu tài chính khác.
        </p>
      </div>
    </div>
  )
}
