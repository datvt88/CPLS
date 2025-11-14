import { StockPriceResponse, FinancialRatiosResponse, StockRecommendationsResponse } from '@/types/vndirect'

/**
 * Fetch historical stock prices via Next.js API proxy
 * This avoids CORS issues and API access restrictions
 * @param stockCode - Stock symbol (e.g., FPT, TCB, VNM)
 * @param size - Number of data points to fetch (default: 270 for ~1 year of data)
 * @param forceRefresh - Force bypass cache and fetch fresh data (default: false)
 */
export async function fetchStockPrices(
  stockCode: string,
  size: number = 270,
  forceRefresh: boolean = false
): Promise<StockPriceResponse> {
  try {
    // Add cache busting parameter when force refresh
    const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : ''
    const url = `/api/vndirect/stock-prices?code=${stockCode.toUpperCase()}&size=${size}${cacheBuster}`

    console.log('📡 Calling API proxy:', url, forceRefresh ? '(force refresh)' : '')

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: forceRefresh ? 'no-store' : 'default',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('✅ API response received:', data.data?.length, 'records')
    return data
  } catch (error) {
    console.error('❌ Error fetching stock prices:', error)
    throw error
  }
}

/**
 * Fetch financial ratios via Next.js API proxy
 * This avoids CORS issues and API access restrictions
 * @param stockCode - Stock symbol (e.g., FPT, TCB, VNM)
 */
export async function fetchFinancialRatios(
  stockCode: string
): Promise<FinancialRatiosResponse> {
  try {
    const url = `/api/vndirect/ratios?code=${stockCode.toUpperCase()}`

    console.log('📡 Calling API proxy for ratios:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('✅ Ratios API response received:', data.data?.length, 'ratios')
    return data
  } catch (error) {
    console.error('❌ Error fetching financial ratios:', error)
    throw error
  }
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
  }

  return result
}

/**
 * Calculate Standard Deviation
 */
export function calculateStdDev(data: number[], period: number, index: number): number {
  if (index < period - 1) return NaN

  const subset = data.slice(index - period + 1, index + 1)
  const mean = subset.reduce((a, b) => a + b, 0) / period
  const squaredDiffs = subset.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period

  return Math.sqrt(variance)
}

/**
 * Calculate Bollinger Bands
 * @param closePrices - Array of closing prices
 * @param period - Period for MA calculation (default: 20)
 * @param stdDev - Number of standard deviations (default: 2)
 */
export function calculateBollingerBands(
  closePrices: number[],
  period: number = 20,
  stdDev: number = 2
) {
  const middleBand = calculateSMA(closePrices, period)
  const upper: number[] = []
  const lower: number[] = []

  for (let i = 0; i < closePrices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN)
      lower.push(NaN)
    } else {
      const sd = calculateStdDev(closePrices, period, i)
      upper.push(middleBand[i] + stdDev * sd)
      lower.push(middleBand[i] - stdDev * sd)
    }
  }

  return { upper, middle: middleBand, lower }
}

/**
 * Calculate Woodie Pivot Points
 * @param high - Previous day high
 * @param low - Previous day low
 * @param close - Previous day close
 */
export function calculateWoodiePivotPoints(high: number, low: number, close: number) {
  const pivot = (high + low + 2 * close) / 4

  const R1 = 2 * pivot - low
  const R2 = pivot + (high - low)
  const R3 = high + 2 * (pivot - low)

  const S1 = 2 * pivot - high
  const S2 = pivot - (high - low)
  const S3 = low - 2 * (high - pivot)

  return {
    pivot: Number(pivot.toFixed(2)),
    R1: Number(R1.toFixed(2)),
    R2: Number(R2.toFixed(2)),
    R3: Number(R3.toFixed(2)),
    S1: Number(S1.toFixed(2)),
    S2: Number(S2.toFixed(2)),
    S3: Number(S3.toFixed(2)),
  }
}

/**
 * Fetch stock recommendations from securities companies via Next.js API proxy
 * This avoids CORS issues and API access restrictions
 * @param stockCode - Stock symbol (e.g., FPT, TCB, VNM)
 * @param startDate - Start date for filtering (format: YYYY-MM-DD)
 * @param size - Number of records to fetch (default: 100)
 */
export async function fetchStockRecommendations(
  stockCode: string,
  startDate?: string,
  size: number = 100
): Promise<StockRecommendationsResponse> {
  try {
    const dateParam = startDate ? `&startDate=${startDate}` : ''
    const url = `/api/vndirect/recommendations?code=${stockCode.toUpperCase()}&size=${size}${dateParam}`

    console.log('📡 Calling API proxy for recommendations:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('✅ Recommendations API response received:', data.data?.length, 'recommendations')
    return data
  } catch (error) {
    console.error('❌ Error fetching stock recommendations:', error)
    throw error
  }
}
