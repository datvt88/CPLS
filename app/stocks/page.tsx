'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import StockFinancialsWidget from '@/components/StockFinancialsWidget'

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
          Woodie Pivot Points và các chỉ số tài chính cơ bản
        </p>
      </div>

      {/* Stock Details Widget with Chart */}
      <StockDetailsWidget
        initialSymbol={currentSymbol}
        onSymbolChange={setCurrentSymbol}
      />

      {/* Stock Financials Widget */}
      <StockFinancialsWidget symbol={currentSymbol} />

      {/* Disclaimer */}
      <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-6 border border-yellow-700/30">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          ⚠️ Lưu ý quan trọng
        </h3>
        <div className="text-sm text-gray-300 space-y-2">
          <p>
            <strong>Dữ liệu thực từ VNDirect API:</strong> Tất cả dữ liệu giá cổ phiếu và chỉ số tài chính
            được lấy từ API chính thức của VNDirect. Dữ liệu có độ trễ nhất định so với thời gian thực.
          </p>
          <p>
            <strong>Mục đích sử dụng:</strong> Công cụ này chỉ phục vụ mục đích tham khảo và nghiên cứu.
            Không nên sử dụng làm cơ sở duy nhất cho quyết định đầu tư.
          </p>
          <p>
            <strong>Chỉ báo kỹ thuật:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>
              <strong>Bollinger Bands (BB):</strong> Dải biến động giá dựa trên độ lệch chuẩn (20 kỳ, 2σ).
              Giá chạm dải trên → quá mua, dải dưới → quá bán.
            </li>
            <li>
              <strong>Woodie Pivot Points:</strong> Các mức hỗ trợ/kháng cự tính theo công thức Woodie.
              Buy T+ (S3) là mức hỗ trợ mạnh, Sell T+ (R3) là mức kháng cự mạnh.
            </li>
          </ul>
          <p className="text-yellow-400 font-semibold mt-3">
            ⚡ Luôn kết hợp phân tích kỹ thuật với phân tích cơ bản và quản trị rủi ro hợp lý.
          </p>
        </div>
      </div>
    </div>
  )
}
