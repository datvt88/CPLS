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
    <div className="h-[500px] w-full flex items-center justify-center bg-[--panel] rounded-xl border border-gray-800">
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

  const stockInfo = getStockBySymbol(selectedStock)

  // Generate mock data for selected stock with correct reference price
  const historicalData = useMemo(() => {
    if (!stockInfo) return []
    return generateMockStockData(180, stockInfo.referencePrice)
  }, [selectedStock, stockInfo])

  // Calculate pivot points
  const pivotPoints = useMemo(() => {
    return calculateWoodiePivotPoints(historicalData)
  }, [historicalData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">Cổ phiếu</h1>
        <p className="text-[--muted]">Theo dõi và phân tích biểu đồ cổ phiếu Việt Nam</p>
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
            <div className="mt-2">
              <div className="text-lg font-semibold">{stock.lastPrice.toFixed(2)}</div>
              <div className="text-xs">
                <span className={stock.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {stock.change >= 0 ? '+' : ''}
                  {stock.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          </button>
        ))}
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
              <div className="text-xs text-yellow-400/70">Reference</div>
            </div>

            {/* Ceiling Price */}
            <div className="bg-orange-900/20 rounded-lg p-4 border border-orange-700/30">
              <div className="text-orange-400 text-xs mb-1">Giá trần</div>
              <div className="text-2xl font-bold text-orange-300">
                {stockInfo.ceilingPrice.toFixed(2)}
              </div>
              <div className="text-xs text-orange-400/70">+7%</div>
            </div>

            {/* Floor Price */}
            <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30">
              <div className="text-purple-400 text-xs mb-1">Giá sàn</div>
              <div className="text-2xl font-bold text-purple-300">
                {stockInfo.floorPrice.toFixed(2)}
              </div>
              <div className="text-xs text-purple-400/70">-7%</div>
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

      {/* Timeframe Selection */}
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
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
      </div>

      {/* Chart */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">
            Biểu đồ nến - {selectedStock}
          </h3>
          <div className="text-sm text-[--muted]">
            {historicalData.length} ngày giao dịch
          </div>
        </div>

        {stockInfo && (
          <LightweightChart
            historicalData={historicalData}
            timeframe={timeframe}
            pivotPoints={pivotPoints}
            floorPrice={stockInfo.floorPrice}
            ceilingPrice={stockInfo.ceilingPrice}
          />
        )}

        {/* Legend */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500"></div>
            <span className="text-[--muted]">Bollinger Bands (Upper/Lower)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-yellow-400"></div>
            <span className="text-[--muted]">Bollinger Middle (SMA 20)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-red-500 border-dashed border-b-2"></div>
            <span className="text-[--muted]">Woodie R3 (Kháng cự)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-green-500 border-dashed border-b-2"></div>
            <span className="text-[--muted]">Woodie S3 (Hỗ trợ)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-orange-500 border-dashed border-b-2"></div>
            <span className="text-[--muted]">Giá trần (+7%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-purple-500 border-dashed border-b-2"></div>
            <span className="text-[--muted]">Giá sàn (-7%)</span>
          </div>
        </div>
      </div>

      {/* Trading Tips */}
      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl p-6 border border-purple-700/30">
        <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
          💡 Hướng dẫn đọc biểu đồ
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <p className="font-semibold text-white mb-1">Bollinger Bands:</p>
            <ul className="list-disc list-inside space-y-1 text-[--muted]">
              <li>Giá chạm band trên: Vùng quá mua, có thể giảm</li>
              <li>Giá chạm band dưới: Vùng quá bán, có thể tăng</li>
              <li>Bands hẹp lại: Báo hiệu biến động sắp tới</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-1">Woodie Pivot Points:</p>
            <ul className="list-disc list-inside space-y-1 text-[--muted]">
              <li>R3 (Resistance): Mức kháng cự mạnh</li>
              <li>S3 (Support): Mức hỗ trợ mạnh</li>
              <li>Phá vỡ R3/S3: Tín hiệu xu hướng mạnh</li>
            </ul>
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
