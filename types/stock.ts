export interface StockPriceData {
  date: string
  open: number
  high: number
  low: number
  close: number
  nmVolume: number
}

export type Timeframe = '1d' | '1w' | '1m'

export interface PivotPoints {
  R3: number
  S3: number
}

export interface BollingerBand {
  time: number
  upper: number
  middle: number
  lower: number
}

export interface StockInfo {
  symbol: string
  name: string
  lastPrice: number
  change: number
  changePercent: number
  volume: number
}
