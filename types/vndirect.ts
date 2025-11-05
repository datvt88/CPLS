// VNDirect API Response Types

export interface StockPriceResponse {
  data: StockPriceData[]
  currentPage: number
  size: number
  totalElements: number
}

export interface StockPriceData {
  date: string
  open: number
  high: number
  low: number
  close: number
  nmVolume: number
  nmValue: number
  ptVolume: number
  ptValue: number
  change: number
  pctChange: number
  code: string
}

export interface FinancialRatiosResponse {
  data: FinancialRatio[]
}

export interface FinancialRatio {
  ratioCode: string
  value: number
}

export interface StockQuote {
  code: string
  currentPrice: number
  ceilingPrice: number
  floorPrice: number
  referencePrice: number
  change: number
  changePercent: number
  totalVolume: number
  totalValue: number
  high: number
  low: number
  open: number
}

export interface BollingerBands {
  upper: number
  middle: number
  lower: number
}

export interface WoodiePivotPoints {
  pivot: number
  R3: number
  R2: number
  R1: number
  S1: number
  S2: number
  S3: number
}
