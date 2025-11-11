'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import StockFinancialsWidget from '@/components/StockFinancialsWidget'
import StockAIEvaluationWidget from '@/components/StockAIEvaluationWidget'

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

      {/* AI Evaluation Widget */}
      <StockAIEvaluationWidget key={`ai-${currentSymbol}`} symbol={currentSymbol} />

      {/* Disclaimer */}
      <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-4 border border-yellow-700/30">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          ⚠️ Lưu ý quan trọng
        </h3>
        <p className="text-sm text-gray-300">
          Dữ liệu cổ phiếu được lấy từ các nguồn công khai trực tuyến. Webapp không chịu trách nhiệm về độ tin cậy của dữ liệu.
          Công cụ phục vụ mục đích thử nghiệm và tham khảo. Không khuyến khích sử dụng để ra quyết định đầu tư.
        </p>
      </div>
    </div>
  )
}
