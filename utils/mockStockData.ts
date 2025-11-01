import type { StockPriceData, StockInfo } from '@/types/stock'

// Generate mock stock price data
export function generateMockStockData(days: number = 180): StockPriceData[] {
  const data: StockPriceData[] = []
  let currentPrice = 50 + Math.random() * 50 // Start between 50-100
  const today = new Date()

  for (let i = days; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    // Simulate price movement with some volatility
    const change = (Math.random() - 0.5) * 5
    currentPrice = Math.max(10, currentPrice + change)

    const open = currentPrice + (Math.random() - 0.5) * 2
    const close = currentPrice + (Math.random() - 0.5) * 2
    const high = Math.max(open, close) + Math.random() * 2
    const low = Math.min(open, close) - Math.random() * 2
    const nmVolume = Math.floor(1000000 + Math.random() * 9000000)

    data.push({
      date: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      nmVolume,
    })
  }

  return data
}

// Mock Vietnamese stock data
export const mockVietnameseStocks: StockInfo[] = [
  {
    symbol: 'VNM',
    name: 'Vinamilk',
    lastPrice: 78.5,
    change: 1.2,
    changePercent: 1.55,
    volume: 3456789,
  },
  {
    symbol: 'VIC',
    name: 'Vingroup',
    lastPrice: 45.3,
    change: -0.8,
    changePercent: -1.74,
    volume: 8765432,
  },
  {
    symbol: 'HPG',
    name: 'Hòa Phát',
    lastPrice: 23.4,
    change: 0.5,
    changePercent: 2.18,
    volume: 12345678,
  },
  {
    symbol: 'VHM',
    name: 'Vinhomes',
    lastPrice: 67.8,
    change: -1.5,
    changePercent: -2.16,
    volume: 5678901,
  },
  {
    symbol: 'TCB',
    name: 'Techcombank',
    lastPrice: 34.6,
    change: 0.9,
    changePercent: 2.67,
    volume: 7890123,
  },
  {
    symbol: 'VPB',
    name: 'VPBank',
    lastPrice: 18.9,
    change: 0.3,
    changePercent: 1.61,
    volume: 9012345,
  },
  {
    symbol: 'GAS',
    name: 'PV Gas',
    lastPrice: 89.2,
    change: 2.1,
    changePercent: 2.41,
    volume: 2345678,
  },
  {
    symbol: 'MSN',
    name: 'Masan Group',
    lastPrice: 56.7,
    change: -0.6,
    changePercent: -1.05,
    volume: 4567890,
  },
]

// Get stock data by symbol
export function getStockBySymbol(symbol: string): StockInfo | undefined {
  return mockVietnameseStocks.find((stock) => stock.symbol === symbol)
}
