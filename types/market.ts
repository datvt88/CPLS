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
  locale: string
  tradingDate: string
  buyRate: number
  sellRate: number
  midRate?: number
  lastUpdated: string
}

// API Response wrappers
export interface VNDirectResponse<T> {
  data: T[]
  total?: number
  page?: number
  size?: number
}

// Helper types
export type PriceChangeColor = 'increase' | 'decrease' | 'neutral' | 'ceiling'
