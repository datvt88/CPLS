import { NextRequest, NextResponse } from 'next/server'

// Development mock data fallback
function generateMockStockData(code: string, size: number) {
  const data = []
  const basePrice = 80000 + Math.random() * 20000
  let currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)

  for (let i = 0; i < size; i++) {
    const dayChange = (Math.random() - 0.5) * 4000
    const open = basePrice + dayChange
    const close = open + (Math.random() - 0.5) * 2000
    const high = Math.max(open, close) + Math.random() * 1000
    const low = Math.min(open, close) - Math.random() * 1000
    const change = close - open
    const pctChange = (change / open) * 100

    data.unshift({
      date: currentDate.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      // Adjusted prices (same as regular for mock data)
      adOpen: Number(open.toFixed(2)),
      adHigh: Number(high.toFixed(2)),
      adLow: Number(low.toFixed(2)),
      adClose: Number(close.toFixed(2)),
      adAverage: Number(((open + close) / 2).toFixed(2)),
      nmVolume: Math.floor(Math.random() * 10000000) + 1000000,
      nmValue: Math.floor(Math.random() * 500000000000) + 100000000000,
      ptVolume: 0,
      ptValue: 0,
      change: Number(change.toFixed(2)),
      pctChange: Number(pctChange.toFixed(2)),
      adChange: Number(change.toFixed(2)),
      code: code.toUpperCase(),
    })

    currentDate.setDate(currentDate.getDate() - 1)
  }

  return data
}

/**
 * Validate and normalize stock price data
 * Ensures all required fields are present and have correct types
 */
function normalizeStockPriceData(data: any) {
  // Helper to safely get number value, using fallback only if source is null/undefined
  const getNumber = (value: any, fallback?: any): number => {
    if (value !== null && value !== undefined && value !== '') {
      const num = Number(value)
      return isNaN(num) ? (fallback !== undefined ? Number(fallback) || 0 : 0) : num
    }
    return fallback !== undefined ? Number(fallback) || 0 : 0
  }

  // Parse all numeric fields
  const open = getNumber(data.open, 0)
  const high = getNumber(data.high, 0)
  const low = getNumber(data.low, 0)
  const close = getNumber(data.close, 0)
  const adOpen = getNumber(data.adOpen, open)
  const adHigh = getNumber(data.adHigh, high)
  const adLow = getNumber(data.adLow, low)
  const adClose = getNumber(data.adClose, close)

  // Use API's adAverage if provided, otherwise calculate from adOpen and adClose
  // Note: 0 is a valid value (e.g., when no trades occurred), so only fallback when null/undefined
  const adAverage = getNumber(data.adAverage, (adOpen + adClose) / 2)

  return {
    date: data.date || '',
    open,
    high,
    low,
    close,
    // Adjusted prices - use these for accurate historical comparison
    adOpen,
    adHigh,
    adLow,
    adClose,
    adAverage,
    nmVolume: getNumber(data.nmVolume, 0),
    nmValue: getNumber(data.nmValue, 0),
    ptVolume: getNumber(data.ptVolume, 0),
    ptValue: getNumber(data.ptValue, 0),
    change: getNumber(data.change, 0),
    pctChange: getNumber(data.pctChange, 0),
    adChange: getNumber(data.adChange, getNumber(data.change, 0)),
    code: String(data.code || '').toUpperCase(),
  }
}

/**
 * Validate date is not from the future
 */
function isValidTradingDate(dateStr: string): boolean {
  try {
    const dataDate = new Date(dateStr)
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    return dataDate <= today && !isNaN(dataDate.getTime())
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const size = parseInt(searchParams.get('size') || '270')

  if (!code) {
    return NextResponse.json(
      { error: 'Missing stock code parameter' },
      { status: 400 }
    )
  }

  try {
    // Sort by date descending to get latest data first
    const url = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${code.toUpperCase()}&size=${size}`

    console.log('🔄 Fetching stock prices from VNDirect API')
    console.log('   Stock Code:', code.toUpperCase())
    console.log('   Data Size:', size)
    console.log('   Full URL:', url)

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://dstock.vndirect.com.vn/',
        'Origin': 'https://dstock.vndirect.com.vn',
      },
      cache: 'no-store', // Disable caching to ensure fresh data for each stock code
    })

    console.log('✅ VNDirect API response status:', response.status)

    if (!response.ok) {
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    const rawData = await response.json()

    console.log('📦 Raw API data received:', {
      code: code.toUpperCase(),
      dataPoints: rawData.data?.length || 0,
      firstDate: rawData.data?.[0]?.date,
      lastDate: rawData.data?.[rawData.data.length - 1]?.date,
    })

    // Log first data point for verification
    if (rawData.data && rawData.data.length > 0) {
      const firstPoint = rawData.data[0]
      console.log('📊 First raw data point:', {
        code: firstPoint.code,
        date: firstPoint.date,
        open: firstPoint.open,
        close: firstPoint.close,
        adAverage: firstPoint.adAverage,
      })
    }

    // Normalize and validate the data
    const normalizedData = {
      ...rawData,
      data: (rawData.data || [])
        .filter((item: any) => isValidTradingDate(item.date))
        .map(normalizeStockPriceData)
        .filter((item: any) => {
          // Filter out invalid data points
          const hasValidPrices = !isNaN(item.open) && !isNaN(item.high) &&
                                !isNaN(item.low) && !isNaN(item.close) &&
                                item.open > 0 && item.high > 0 &&
                                item.low > 0 && item.close > 0

          if (!hasValidPrices) {
            console.warn('⚠️ Filtered out invalid data point:', item.date, item)
          }

          return hasValidPrices
        })
    }

    // Log first normalized data point for verification
    if (normalizedData.data && normalizedData.data.length > 0) {
      const firstNormalized = normalizedData.data[0]
      console.log('✅ First normalized data point:', {
        code: firstNormalized.code,
        date: firstNormalized.date,
        open: firstNormalized.open,
        close: firstNormalized.close,
        adAverage: firstNormalized.adAverage,
      })
    }

    console.log('✅ Total normalized data points:', normalizedData.data.length)

    return NextResponse.json(normalizedData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('⚠️ VNDirect API unavailable, using mock data for development:', error)

    // Return mock data for development/testing when API is unavailable
    const mockData = {
      data: generateMockStockData(code, size),
      currentPage: 1,
      size: size,
      totalElements: size,
    }

    return NextResponse.json(mockData, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
        'X-Mock-Data': 'true', // Indicator that this is mock data
      },
    })
  }
}
