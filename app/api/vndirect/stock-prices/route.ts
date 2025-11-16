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
  return {
    date: data.date || '',
    open: Number(data.open) || 0,
    high: Number(data.high) || 0,
    low: Number(data.low) || 0,
    close: Number(data.close) || 0,
    // Adjusted prices - use these for accurate historical comparison
    adOpen: Number(data.adOpen) || Number(data.open) || 0,
    adHigh: Number(data.adHigh) || Number(data.high) || 0,
    adLow: Number(data.adLow) || Number(data.low) || 0,
    adClose: Number(data.adClose) || Number(data.close) || 0,
    adAverage: Number(data.adAverage) || Number((data.adOpen + data.adClose) / 2) || 0,
    nmVolume: Number(data.nmVolume) || 0,
    nmValue: Number(data.nmValue) || 0,
    ptVolume: Number(data.ptVolume) || 0,
    ptValue: Number(data.ptValue) || 0,
    change: Number(data.change) || 0,
    pctChange: Number(data.pctChange) || 0,
    adChange: Number(data.adChange) || Number(data.change) || 0,
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
      next: { revalidate: 120 }, // Cache for 2 minutes (reduced for fresher trading data)
    })

    console.log('✅ VNDirect API response status:', response.status)

    if (!response.ok) {
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    const rawData = await response.json()

    // Normalize and validate the data
    const normalizedData = {
      ...rawData,
      data: (rawData.data || [])
        .filter((item: any) => isValidTradingDate(item.date))
        .map(normalizeStockPriceData)
    }

    return NextResponse.json(normalizedData, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
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
