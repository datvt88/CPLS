'use client'

import { useState, useEffect } from 'react'

interface StockData {
  ticker: string
  price?: number
  ma10?: number
  ma30?: number
  macdv?: number
  avgNmValue?: number
  note?: string
}

export default function GoldenCrossSignalsWidget() {
  const [stocks, setStocks] = useState<StockData[]>([])
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

      // Extract stock data from Firebase
      const stockList: StockData[] = []
      if (data.data && typeof data.data === 'object') {
        // Firebase returns object with keys as stock symbols
        Object.keys(data.data).forEach(symbol => {
          const stockInfo = data.data[symbol]
          stockList.push({
            ticker: stockInfo.ticker || symbol,
            price: stockInfo.price,
            ma10: stockInfo.ma10,
            ma30: stockInfo.ma30,
            macdv: stockInfo.macdv,
            avgNmValue: stockInfo.avgNmValue,
            note: stockInfo.note
          })
        })
      }

      setStocks(stockList)
    } catch (err: any) {
      console.error('Error fetching stocks:', err)
      setError(err.message || 'Không thể tải danh sách cổ phiếu')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '-'
    return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 font-semibold text-gray-300">Mã CP</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-300">Giá</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-300">MA10</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-300">MA30</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-300">MACDV</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-300">Avg Volume</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-300">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock, index) => (
              <tr
                key={stock.ticker}
                className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
              >
                <td className="py-3 px-4">
                  <span className="font-bold text-white">{stock.ticker}</span>
                </td>
                <td className="py-3 px-4 text-right text-green-400 font-semibold">
                  {formatNumber(stock.price)}
                </td>
                <td className="py-3 px-4 text-right text-cyan-400">
                  {formatNumber(stock.ma10)}
                </td>
                <td className="py-3 px-4 text-right text-cyan-400">
                  {formatNumber(stock.ma30)}
                </td>
                <td className="py-3 px-4 text-right text-purple-400">
                  {formatNumber(stock.macdv)}
                </td>
                <td className="py-3 px-4 text-right text-gray-400">
                  {formatNumber(stock.avgNmValue)}
                </td>
                <td className="py-3 px-4 text-gray-400">
                  {stock.note || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
