import type { StockPriceData, StockInfo } from '@/types/stock'

// Generate mock stock price data
export function generateMockStockData(days: number = 180, referencePrice: number = 75): StockPriceData[] {
  const data: StockPriceData[] = []
  let currentPrice = referencePrice
  const today = new Date()

  for (let i = days; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    // Simulate price movement with some volatility
    const change = (Math.random() - 0.5) * 3
    currentPrice = Math.max(10, currentPrice + change)

    const open = currentPrice + (Math.random() - 0.5) * 2
    const close = currentPrice + (Math.random() - 0.5) * 2
    const high = Math.max(open, close) + Math.random() * 1.5
    const low = Math.min(open, close) - Math.random() * 1.5
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
    referencePrice: 77.3,
    lastPrice: 78.5,
    change: 1.2,
    changePercent: 1.55,
    volume: 3456789,
    floorPrice: 71.9, // -7%
    ceilingPrice: 82.7, // +7%
  },
  {
    symbol: 'VIC',
    name: 'Vingroup',
    referencePrice: 46.1,
    lastPrice: 45.3,
    change: -0.8,
    changePercent: -1.74,
    volume: 8765432,
    floorPrice: 42.9,
    ceilingPrice: 49.3,
  },
  {
    symbol: 'HPG',
    name: 'Hòa Phát',
    referencePrice: 22.9,
    lastPrice: 23.4,
    change: 0.5,
    changePercent: 2.18,
    volume: 12345678,
    floorPrice: 21.3,
    ceilingPrice: 24.5,
  },
  {
    symbol: 'VHM',
    name: 'Vinhomes',
    referencePrice: 69.3,
    lastPrice: 67.8,
    change: -1.5,
    changePercent: -2.16,
    volume: 5678901,
    floorPrice: 64.5,
    ceilingPrice: 74.2,
  },
  {
    symbol: 'TCB',
    name: 'Techcombank',
    referencePrice: 33.7,
    lastPrice: 34.6,
    change: 0.9,
    changePercent: 2.67,
    volume: 7890123,
    floorPrice: 31.3,
    ceilingPrice: 36.1,
  },
  {
    symbol: 'VPB',
    name: 'VPBank',
    referencePrice: 18.6,
    lastPrice: 18.9,
    change: 0.3,
    changePercent: 1.61,
    volume: 9012345,
    floorPrice: 17.3,
    ceilingPrice: 19.9,
  },
  {
    symbol: 'GAS',
    name: 'PV Gas',
    referencePrice: 87.1,
    lastPrice: 89.2,
    change: 2.1,
    changePercent: 2.41,
    volume: 2345678,
    floorPrice: 81.0,
    ceilingPrice: 93.2,
  },
  {
    symbol: 'MSN',
    name: 'Masan Group',
    referencePrice: 57.3,
    lastPrice: 56.7,
    change: -0.6,
    changePercent: -1.05,
    volume: 4567890,
    floorPrice: 53.3,
    ceilingPrice: 61.3,
  },
]

// Get stock data by symbol
export function getStockBySymbol(symbol: string): StockInfo | undefined {
  // First try to find in predefined stocks
  const existing = mockVietnameseStocks.find((stock) => stock.symbol === symbol)
  if (existing) {
    return existing
  }

  // If not found, generate mock data for the entered symbol
  if (symbol && symbol.trim() !== '') {
    // Generate random but reasonable stock data
    const referencePrice = Number((30 + Math.random() * 70).toFixed(2)) // Random price between 30-100
    const changePercent = Number(((Math.random() - 0.5) * 6).toFixed(2)) // Random change between -3% to +3%
    const change = Number((referencePrice * changePercent / 100).toFixed(2))
    const lastPrice = Number((referencePrice + change).toFixed(2))
    const volume = Math.floor(1000000 + Math.random() * 10000000)

    return {
      symbol: symbol.toUpperCase(),
      name: `Cổ phiếu ${symbol.toUpperCase()}`,
      referencePrice,
      lastPrice,
      change,
      changePercent,
      volume,
      floorPrice: Number((referencePrice * 0.93).toFixed(2)), // -7%
      ceilingPrice: Number((referencePrice * 1.07).toFixed(2)), // +7%
    }
  }

  return undefined
}
