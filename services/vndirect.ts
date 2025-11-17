import { StockPriceResponse, FinancialRatiosResponse, StockRecommendationsResponse } from '@/types/vndirect'

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`⚠️ Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`)

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // If we got here, all retries failed
  throw lastError
}

/**
 * Fetch historical stock prices via Next.js API proxy
 * This avoids CORS issues and API access restrictions
 * @param stockCode - Stock symbol (e.g., FPT, TCB, VNM)
 * @param size - Number of data points to fetch (default: 270 for ~1 year of data)
 * @param forceRefresh - Force bypass cache and fetch fresh data (default: false)
 * @param signal - AbortSignal to cancel the request
 */
export async function fetchStockPrices(
  stockCode: string,
  size: number = 270,
  forceRefresh: boolean = false,
  signal?: AbortSignal
): Promise<StockPriceResponse> {
  // Wrap fetch in retry logic
  return retryWithBackoff(async () => {
    try {
      // Add version parameter to bust cache when API data format changes
      // Increment API_VER when changing price normalization logic
      const API_VER = '2' // v2: using raw API prices without conversion
      const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : ''
      const url = `/api/vndirect/stock-prices?code=${stockCode.toUpperCase()}&size=${size}&v=${API_VER}${cacheBuster}`

      console.log('📡 Calling API proxy:', url, forceRefresh ? '(force refresh)' : '')

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // Always fetch fresh data for real-time stock prices
        // Stock market data changes frequently and needs to be current
        cache: 'no-store',
        signal, // Pass abort signal to fetch
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('✅ API response received:', data.data?.length, 'records')

      // Check if data is from mock or real API
      const dataSource = response.headers.get('X-Data-Source')
      if (dataSource === 'mock-data') {
        console.warn('⚠️⚠️⚠️ USING MOCK DATA - VNDirect API is unavailable!')
        console.warn('⚠️ Prices shown are randomly generated, not real market data!')
        console.warn('⚠️ Check server logs for VNDirect API errors')
      } else if (dataSource === 'vndirect-api') {
        console.log('✅ Data from VNDirect API (real market data)')
      }

      return data
    } catch (error) {
      // Don't log error if request was aborted (user cancelled)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⚠️ Request aborted by user')
        throw error
      }
      console.error('❌ Error fetching stock prices:', error)
      throw error
    }
  }, 3, 1000) // 3 retries with 1s base delay
}

/**
 * Fetch financial ratios via Next.js API proxy
 * This avoids CORS issues and API access restrictions
 * @param stockCode - Stock symbol (e.g., FPT, TCB, VNM)
 */
export async function fetchFinancialRatios(
  stockCode: string,
  signal?: AbortSignal
): Promise<FinancialRatiosResponse> {
  // Wrap fetch in retry logic
  return retryWithBackoff(async () => {
    try {
      const url = `/api/vndirect/ratios?code=${stockCode.toUpperCase()}`

      console.log('📡 Calling API proxy for ratios:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('✅ Ratios API response received:', data.data?.length, 'ratios')
      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⚠️ Request aborted by user')
        throw error
      }
      console.error('❌ Error fetching financial ratios:', error)
      throw error
    }
  }, 3, 1000)
}

/**
 * Calculate Simple Moving Average
 * @param data - Array of price data
 * @param period - Period for SMA calculation
 */
export function calculateSMA(data: number[], period: number): number[] {
  // Validate inputs
  if (!Array.isArray(data) || data.length === 0) {
    return []
  }
  if (period <= 0 || period > data.length) {
    return new Array(data.length).fill(NaN)
  }

  const result: number[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const subset = data.slice(i - period + 1, i + 1)
      // Check for invalid values in subset
      if (subset.some(v => v === null || v === undefined || isNaN(v))) {
        result.push(NaN)
      } else {
        const sum = subset.reduce((a, b) => a + b, 0)
        result.push(sum / period)
      }
    }
  }

  return result
}

/**
 * Calculate Standard Deviation
 * @param data - Array of price data
 * @param period - Period for calculation
 * @param index - Index to calculate at
 */
export function calculateStdDev(data: number[], period: number, index: number): number {
  // Validate inputs
  if (!Array.isArray(data) || data.length === 0) return NaN
  if (period <= 0 || index < 0 || index >= data.length) return NaN
  if (index < period - 1) return NaN

  const subset = data.slice(index - period + 1, index + 1)

  // Check for invalid values
  if (subset.some(v => v === null || v === undefined || isNaN(v))) {
    return NaN
  }

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
 * @returns Pivot points with resistance (R1-R3) and support (S1-S3) levels, or null if inputs are invalid
 */
export function calculateWoodiePivotPoints(
  high: number,
  low: number,
  close: number
): { pivot: number; R1: number; R2: number; R3: number; S1: number; S2: number; S3: number } | null {
  // Validate inputs - return null instead of throwing for graceful degradation
  if (
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    isNaN(high) ||
    isNaN(low) ||
    isNaN(close)
  ) {
    console.warn('⚠️ Invalid pivot point inputs: prices must be positive and numeric')
    return null
  }

  if (high < low) {
    console.warn('⚠️ Invalid pivot point inputs: high must be >= low')
    return null
  }

  if (close < low || close > high) {
    console.warn('⚠️ Invalid pivot point inputs: close must be between low and high')
    return null
  }

  // Woodie's formula: Pivot = (H + L + 2*C) / 4
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
  size: number = 100,
  signal?: AbortSignal
): Promise<StockRecommendationsResponse> {
  // Wrap fetch in retry logic
  return retryWithBackoff(async () => {
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
        signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log('✅ Recommendations API response received:', data.data?.length, 'recommendations')
      return data
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('⚠️ Request aborted by user')
        throw error
      }
      console.error('❌ Error fetching stock recommendations:', error)
      throw error
    }
  }, 3, 1000)
}
