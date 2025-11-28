'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import StockFinancialsWidget from '@/components/StockFinancialsWidget'
import StockProfitabilityWidget from '@/components/StockProfitabilityWidget'
import StockProfitStructureWidget from '@/components/StockProfitStructureWidget'
import StockAIEvaluationWidget from '@/components/StockAIEvaluationWidget'
import StockRecommendationsWidget from '@/components/StockRecommendationsWidget'

// Dynamic import to avoid SSR issues with lightweight-charts
const StockDetailsWidget = dynamic(
  () => import('@/components/StockDetailsWidget'),
  {
    ssr: false,
    loading: () => (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-[600px]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 text-lg">Đang tải biểu đồ...</p>
          </div>
        </div>
      </div>
    ),
  }
)

export default function StocksPage() {
  const [currentSymbol, setCurrentSymbol] = useState('VNM')

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5">
      {/* Header */}
      <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1.5 sm:mb-2">📈 Phân tích Cổ phiếu</h1>
        <p className="text-xs sm:text-sm md:text-base text-[--muted]">
          Công cụ phân tích chuyên sâu với biểu đồ kỹ thuật, chỉ báo Bollinger Bands,
          Pivot Points và các chỉ số tài chính cơ bản
        </p>
      </div>

      {/* Stock Details Widget with Chart */}
      <StockDetailsWidget
        initialSymbol={currentSymbol}
        onSymbolChange={setCurrentSymbol}
      />

      {/* Stock Financials Widget */}
      <StockFinancialsWidget key={currentSymbol} symbol={currentSymbol} />

      {/* Stock Profitability Widget (ROE/ROA) */}
      <StockProfitabilityWidget key={`profitability-${currentSymbol}`} symbol={currentSymbol} />

      {/* Stock Profit Structure Widget */}
      <StockProfitStructureWidget key={`profit-structure-${currentSymbol}`} symbol={currentSymbol} />

      {/* Stock Recommendations Widget */}
      <StockRecommendationsWidget key={`rec-${currentSymbol}`} symbol={currentSymbol} />

      {/* AI Evaluation Widget */}
      <StockAIEvaluationWidget key={`ai-${currentSymbol}`} symbol={currentSymbol} />
    </div>
  )
}
