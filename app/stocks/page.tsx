'use client'
import { useState } from 'react'
import StockDetailsWidget from '@/components/stocks/StockDetailsWidget'
import StockFinancialsWidget from '@/components/stocks/StockFinancialsWidget'

export default function StocksPage() {
  const [stockCode, setStockCode] = useState('TCB')
  const [searchInput, setSearchInput] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setStockCode(searchInput.trim().toUpperCase())
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Phân tích Cổ phiếu</h1>
            <p className="text-muted mt-1">Công cụ phân tích kỹ thuật và chỉ số tài chính</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-panel border border-gray-800 rounded-lg p-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nhập mã cổ phiếu (VD: TCB, FPT, VNM...)"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Tìm kiếm
            </button>
          </form>
          <p className="text-xs text-muted mt-2">
            Hiện đang xem: <span className="text-purple-500 font-semibold">{stockCode}</span>
          </p>
        </div>

        {/* Stock Details with Chart */}
        <StockDetailsWidget stockCode={stockCode} />

        {/* Financial Ratios */}
        <StockFinancialsWidget stockCode={stockCode} />
      </div>
    </div>
  )
}
