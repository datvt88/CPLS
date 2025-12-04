'use client'

import { useState, useEffect } from 'react'

interface StockSymbol {
  symbol: string
  [key: string]: any
}

export default function GoldenCrossSignalsWidget() {
  const [stocks, setStocks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStocksFromFirebase()
  }, [])

  const fetchStocksFromFirebase = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get stock list from Firebase via API
      const response = await fetch('/api/signals/golden-cross')
      if (!response.ok) {
        throw new Error('Failed to fetch stocks from Firebase')
      }

      const data = await response.json()

      // Extract stock symbols from Firebase data
      const stockList: string[] = []
      if (data.data && typeof data.data === 'object') {
        // Firebase returns object with keys as stock symbols
        stockList.push(...Object.keys(data.data))
      }

      setStocks(stockList)
    } catch (err: any) {
      console.error('Error fetching stocks:', err)
      setError(err.message || 'Không thể tải danh sách cổ phiếu')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-60">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải danh sách cổ phiếu...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          📊 Danh sách mã cổ phiếu
        </h3>
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 text-blue-400">
          Chưa có mã cổ phiếu nào trong danh sách
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
          📊 Danh sách mã cổ phiếu
        </h3>
        <p className="text-gray-400 text-sm mt-1">
          {stocks.length} mã cổ phiếu từ Firebase Realtime Database
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {stocks.map((symbol) => (
          <div
            key={symbol}
            className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-lg p-4 border border-gray-700/50 hover:border-purple-500/50 transition-colors"
          >
            <div className="text-center">
              <div className="text-xl font-bold text-white">{symbol}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
