// Market data types for VNDirect API

// Securities & Indices
export interface IndexData {
  code: string
  index?: string
  lastPrice: number
  lastUpdated: string
  priceChgCr1D: number
  priceChgPctCr1D: number
  highPrice?: number
  lowPrice?: number
  openPrice?: number
  totalVolume?: number
  totalValue?: number
}

// Top Gainers
export interface TopGainerStock {
  code: string
  index: string
  lastPrice: number
  lastUpdated: string
  priceChgCr1D: number
  priceChgPctCr1D: number
  accumulatedVal: number
  nmVolumeAvgCr20D: number
  nmVolNmVolAvg20DPctCr?: number
  totalVolumeAvgCr20D?: number
}

// World Indices
export interface WorldIndexData {
  code: string
  lastPrice: number
  lastUpdated: string
  priceChgCr1D: number
  priceChgPctCr1D: number
  highPrice?: number
  lowPrice?: number
  openPrice?: number
}

// Commodities
export interface CommodityData {
  code: string
  lastPrice: number
  lastUpdated: string
  priceChgCr1D: number
  priceChgPctCr1D: number
  unit?: string
}

// Exchange Rates
export interface ExchangeRateData {
  code: string
  codeName: string
  tradingDate: string
  openPrice: number
  highPrice: number
  lowPrice: number
  closePrice: number
  change: number
  changePct: number
  locale: string
}

// API Response wrappers
export interface VNDirectResponse<T> {
  data: T[]
  currentPage?: number
  size?: number
  totalElements?: number
  totalPages?: number
  // Legacy fields for backwards compatibility
  total?: number
  page?: number
}

// Helper types
export type PriceChangeColor = 'increase' | 'decrease' | 'neutral' | 'ceiling'
