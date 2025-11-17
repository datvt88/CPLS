/**
 * Client-side VNDirect API calls
 * Bypasses Next.js API route to avoid 403 Forbidden from VNDirect
 */

import type {
  StockPriceData,
  StockPriceResponse,
  FinancialRatiosResponse,
  StockRecommendationsResponse
} from '@/types/vndirect'

/**
 * Fetch stock prices directly from VNDirect API (client-side)
 * This avoids 403 errors from server-side fetch
 */
export async function fetchStockPricesClient(
  stockCode: string,
  size: number = 150,
  signal?: AbortSignal
): Promise<StockPriceResponse> {
  const url = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${stockCode.toUpperCase()}&size=${size}`

  console.log('🌐 Fetching directly from VNDirect (client-side):', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`VNDirect API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('✅ VNDirect direct response:', data.data?.length, 'records')

  return {
    ...data,
    data: (data.data || []).map((item: any) => ({
      date: item.date || '',
      open: Number(item.open) || 0,
      high: Number(item.high) || 0,
      low: Number(item.low) || 0,
      close: Number(item.close) || 0,
      adOpen: Number(item.adOpen || item.open) || 0,
      adHigh: Number(item.adHigh || item.high) || 0,
      adLow: Number(item.adLow || item.low) || 0,
      adClose: Number(item.adClose || item.close) || 0,
      adAverage: Number(item.adAverage) || 0,
      nmVolume: Number(item.nmVolume) || 0,
      nmValue: Number(item.nmValue) || 0,
      ptVolume: Number(item.ptVolume) || 0,
      ptValue: Number(item.ptValue) || 0,
      change: Number(item.change) || 0,
      pctChange: Number(item.pctChange) || 0,
      adChange: Number(item.adChange || item.change) || 0,
      code: String(item.code || '').toUpperCase(),
    }))
  }
}

/**
 * Fetch financial ratios directly from VNDirect API (client-side)
 * This avoids 403 errors from server-side fetch
 */
export async function fetchFinancialRatiosClient(
  stockCode: string,
  signal?: AbortSignal
): Promise<FinancialRatiosResponse> {
  const ratios = [
    'MARKETCAP',
    'NMVOLUME_AVG_CR_10D',
    'PRICE_HIGHEST_CR_52W',
    'PRICE_LOWEST_CR_52W',
    'OUTSTANDING_SHARES',
    'FREEFLOAT',
    'BETA',
    'PRICE_TO_EARNINGS',
    'PRICE_TO_BOOK',
    'DIVIDEND_YIELD',
    'BVPS_CR',
    'ROAE_TR_AVG5Q',
    'ROAA_TR_AVG5Q',
    'EPS_TR',
  ]

  const ratiosQuery = ratios.join(',')
  const url = `https://api-finfo.vndirect.com.vn/v4/ratios?q=code:${stockCode.toUpperCase()}~ratioCode:${ratiosQuery}`

  console.log('🌐 Fetching ratios directly from VNDirect (client-side):', stockCode)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`VNDirect Ratios API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('✅ Ratios API response received:', data.data?.length, 'ratios')

  // Debug logging for SSI or when data is sparse
  if (data.data && data.data.length > 0) {
    console.log('📊 Sample ratio data:', data.data[0])
    const ratiosCodes = data.data.map((r: any) => r.ratioCode)
    console.log('📋 Available ratio codes:', ratiosCodes.join(', '))
  }

  return {
    ...data,
    data: (data.data || []).map((item: any) => {
      const ratioCode = String(item.ratioCode || '')
      let value = Number(item.value) || 0

      // VNDirect API returns price values in thousands (similar to targetPrice in recommendations)
      // Example: 35300 means 35.3 VND, so divide by 1000
      if (ratioCode === 'PRICE_HIGHEST_CR_52W' ||
          ratioCode === 'PRICE_LOWEST_CR_52W' ||
          ratioCode === 'BVPS_CR' ||
          ratioCode === 'EPS_TR') {
        value = value / 1000
      }

      return {
        ratioCode: ratioCode,
        value: value,
      }
    })
  }
}

/**
 * Fetch recommendations directly from VNDirect API (client-side)
 * This avoids 403 errors from server-side fetch
 */
export async function fetchRecommendationsClient(
  stockCode: string,
  signal?: AbortSignal
): Promise<StockRecommendationsResponse> {
  // Calculate date 12 months ago for filtering
  const date12MonthsAgo = new Date()
  date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12)
  const dateFilter = date12MonthsAgo.toISOString().split('T')[0] // Format: YYYY-MM-DD

  // Use the correct recommendations endpoint with date filter
  const url = `https://api-finfo.vndirect.com.vn/v4/recommendations?q=code:${stockCode.toUpperCase()}~reportDate:gte:${dateFilter}&size=100&sort=reportDate:DESC`

  console.log('🌐 Fetching recommendations directly from VNDirect (client-side):', stockCode)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`VNDirect Recommendations API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('✅ Recommendations API response received:', data.data?.length, 'recommendations')

  // Debug logging
  if (data.data && data.data.length > 0) {
    console.log('📊 Sample recommendation:', data.data[0])
  } else {
    console.warn('⚠️ No recommendations found for', stockCode)
  }

  return {
    ...data,
    data: (data.data || []).map((item: any) => {
      // Helper to parse price values (avoid || undefined which treats 0 as falsy)
      const parsePrice = (val: any): number | undefined => {
        if (val === null || val === undefined || val === '') return undefined
        const num = Number(val)
        return isNaN(num) ? undefined : num
      }

      // VNDirect API returns prices in different formats:
      // - reportPrice: actual VND (e.g., 28.65)
      // - targetPrice: thousands of VND (e.g., 35300.0 = 35.3 VND)
      // - avgTargetPrice: thousands of VND (e.g., 30022.96 = 30.02 VND)
      const reportPrice = parsePrice(item.reportPrice)
      const targetPrice = parsePrice(item.targetPrice)
      const avgTargetPrice = parsePrice(item.avgTargetPrice)

      return {
        code: String(item.code || ''),
        firm: String(item.firm || ''),
        type: String(item.type || ''),
        reportDate: item.reportDate || '',
        source: String(item.source || ''),
        analyst: String(item.analyst || ''),
        reportPrice: reportPrice,
        targetPrice: targetPrice !== undefined ? targetPrice / 1000 : undefined,
        avgTargetPrice: avgTargetPrice !== undefined ? avgTargetPrice / 1000 : undefined,
      }
    })
  }
}
