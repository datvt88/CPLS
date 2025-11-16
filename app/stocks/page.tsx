'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import StockFinancialsWidget from '@/components/StockFinancialsWidget'
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

  // Symbol change flow:
  // 1. User enters new stock code in StockDetailsWidget input
  // 2. StockDetailsWidget calls setCurrentSymbol via onSymbolChange callback
  // 3. currentSymbol state updates, triggering re-render
  // 4. All widgets receive new symbol via props (key ensures fresh mount)
  // 5. Each widget's useEffect triggers with new symbol
  // 6. Each widget fetches data: /api/vndirect/*?code={NEW_SYMBOL}
  // 7. API routes build VNDirect URLs: ...&q=code:{NEW_SYMBOL} or ...&where=code:{NEW_SYMBOL}
  // 8. Fresh data displayed for new stock code

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">📈 Phân tích Cổ phiếu</h1>
        <p className="text-[--muted]">
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

      {/* Stock Recommendations Widget */}
      <StockRecommendationsWidget key={`rec-${currentSymbol}`} symbol={currentSymbol} />

      {/* AI Evaluation Widget */}
      <StockAIEvaluationWidget key={`ai-${currentSymbol}`} symbol={currentSymbol} />
    </div>
  )
}
