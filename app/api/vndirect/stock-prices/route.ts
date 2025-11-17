import { NextRequest, NextResponse } from 'next/server'

// Development mock data fallback
// Generates data in thousands format (nghìn VND) to match VNDirect API behavior
function generateMockStockData(code: string, size: number) {
  const data = []
  // Base price in thousands (80-100 nghìn VND)
  const basePrice = 80 + Math.random() * 20
  let currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)

  let generatedCount = 0
  while (generatedCount < size) {
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = currentDate.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const dayChange = (Math.random() - 0.5) * 4
      const open = basePrice + dayChange
      const close = open + (Math.random() - 0.5) * 2
      const high = Math.max(open, close) + Math.random() * 1
      const low = Math.min(open, close) - Math.random() * 1
      const change = close - open
      const pctChange = (change / open) * 100

      data.unshift({
        date: currentDate.toISOString().split('T')[0],
        // Prices in thousands format (will be multiplied by 1000 in normalize)
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

      generatedCount++
    }

    currentDate.setDate(currentDate.getDate() - 1)
  }

  return data
}

/**
 * Validate OHLC data integrity
 * Ensures high >= low and high >= max(open, close), low <= min(open, close)
 * Uses tolerance for floating point comparison
 */
function isValidOHLC(open: number, high: number, low: number, close: number): boolean {
  // Floating point tolerance (0.01 VND)
  const TOLERANCE = 0.01

  // All prices must be positive
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) {
    return false
  }

  // High must be >= max(open, close) - with tolerance
  const maxPrice = Math.max(open, close)
  if (high < maxPrice - TOLERANCE) {
    return false
  }

  // Low must be <= min(open, close) - with tolerance
  const minPrice = Math.min(open, close)
  if (low > minPrice + TOLERANCE) {
    return false
  }

  // High must be >= low - with tolerance
  if (high < low - TOLERANCE) {
    return false
  }

  return true
}

/**
 * Detect if stock prices are in thousands format (nghìn VND)
 * VN stock prices typically range from 10,000 - 500,000 VND
 * VNDirect API returns prices in thousands (e.g., 34.65 = 34,650 VND)
 */
function detectStockPriceFormat(data: any): 'thousands' | 'vnd' {
  const prices = [data.open, data.high, data.low, data.close, data.basicPrice]
    .filter(p => p !== null && p !== undefined && !isNaN(Number(p)))
    .map(p => Number(p))

  if (prices.length === 0) return 'thousands' // Default to thousands for VNDirect

  // If ALL prices are < 1000, they're in thousands format (VNDirect standard)
  // Vietnamese stocks rarely trade below 1,000 VND, typically 10,000-500,000 VND
  const allUnder1000 = prices.every(p => p < 1000)
  const anyOver10000 = prices.some(p => p >= 10000)

  if (anyOver10000) return 'vnd' // Already in VND
  if (allUnder1000) return 'thousands' // In thousands (need × 1000)

  // Mixed case - use heuristic: if average > 5000, likely VND
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  return avg > 5000 ? 'vnd' : 'thousands'
}

/**
 * Validate and normalize stock price data
 * Ensures all required fields are present and have correct types
 * Converts prices from thousands to VND if needed
 */
function normalizeStockPriceData(data: any) {
  // Parse numbers carefully - don't use || 0 which converts valid 0 values
  const parseNumber = (val: any): number => {
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }

  // Detect price format (VNDirect returns in thousands)
  const format = detectStockPriceFormat(data)
  const multiplier = format === 'thousands' ? 1000 : 1

  // Helper to parse and convert price
  const parsePrice = (val: any): number => {
    return parseNumber(val) * multiplier
  }

  const normalized = {
    date: data.date || '',
    open: parsePrice(data.open),
    high: parsePrice(data.high),
    low: parsePrice(data.low),
    close: parsePrice(data.close),
    // Adjusted prices - use these for accurate historical comparison
    // If adOpen exists, use it, otherwise fall back to open
    adOpen: data.adOpen !== undefined && data.adOpen !== null
      ? parsePrice(data.adOpen)
      : parsePrice(data.open),
    adHigh: data.adHigh !== undefined && data.adHigh !== null
      ? parsePrice(data.adHigh)
      : parsePrice(data.high),
    adLow: data.adLow !== undefined && data.adLow !== null
      ? parsePrice(data.adLow)
      : parsePrice(data.low),
    adClose: data.adClose !== undefined && data.adClose !== null
      ? parsePrice(data.adClose)
      : parsePrice(data.close),
    adAverage: data.adAverage !== undefined && data.adAverage !== null
      ? parsePrice(data.adAverage)
      : (parsePrice(data.adOpen || data.open) + parsePrice(data.adClose || data.close)) / 2,
    nmVolume: parseNumber(data.nmVolume),
    nmValue: parseNumber(data.nmValue),
    ptVolume: parseNumber(data.ptVolume),
    ptValue: parseNumber(data.ptValue),
    change: parsePrice(data.change),
    pctChange: parseNumber(data.pctChange),
    adChange: data.adChange !== undefined && data.adChange !== null
      ? parsePrice(data.adChange)
      : parsePrice(data.change),
    code: String(data.code || '').toUpperCase(),
  }

  // Validate OHLC integrity - if invalid, return null to filter out
  if (!isValidOHLC(normalized.open, normalized.high, normalized.low, normalized.close)) {
    console.warn('⚠️ Invalid OHLC data detected:', {
      date: normalized.date,
      code: normalized.code,
      open: normalized.open,
      high: normalized.high,
      low: normalized.low,
      close: normalized.close,
      raw: { open: data.open, high: data.high, low: data.low, close: data.close }
    })
    return null
  }

  // Validate adjusted prices too - only if they differ from regular prices
  const hasAdjustedPrices = (
    data.adOpen !== undefined ||
    data.adHigh !== undefined ||
    data.adLow !== undefined ||
    data.adClose !== undefined
  )

  if (hasAdjustedPrices && !isValidOHLC(normalized.adOpen, normalized.adHigh, normalized.adLow, normalized.adClose)) {
    console.warn('⚠️ Invalid adjusted OHLC data detected:', {
      date: normalized.date,
      code: normalized.code,
      adOpen: normalized.adOpen,
      adHigh: normalized.adHigh,
      adLow: normalized.adLow,
      adClose: normalized.adClose,
      raw: { adOpen: data.adOpen, adHigh: data.adHigh, adLow: data.adLow, adClose: data.adClose }
    })
    return null
  }

  return normalized
}

/**
 * Get current date in Vietnam timezone (GMT+7)
 * Returns date at end of day for accurate comparison
 */
function getVietnamDate(): Date {
  const now = new Date()
  // Convert to Vietnam timezone (UTC+7)
  const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  vietnamTime.setHours(23, 59, 59, 999) // End of today
  return vietnamTime
}

/**
 * Validate date is not from the future and is a valid date
 */
function isValidTradingDate(dateStr: string): boolean {
  try {
    const dataDate = new Date(dateStr)
    // Check if date is valid
    if (isNaN(dataDate.getTime())) {
      return false
    }

    // Set to start of day for comparison
    dataDate.setHours(0, 0, 0, 0)

    const today = getVietnamDate()

    // Data should not be from the future
    return dataDate <= today
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

    console.log('🔄 Proxy fetching from VNDirect:', url)

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
      const errorText = await response.text()
      console.error('❌ VNDirect API error:', response.status, errorText)
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    const rawData = await response.json()

    // Validate API response structure
    if (!rawData || typeof rawData !== 'object') {
      console.error('❌ Invalid API response structure:', rawData)
      throw new Error('Invalid API response structure')
    }

    // Log sample data for debugging (first record is LATEST due to sort=date:desc)
    if (rawData.data && rawData.data.length > 0) {
      const latest = rawData.data[0]
      const format = detectStockPriceFormat(latest)
      console.log(`📊 Raw API data for ${code}:`, {
        totalRecords: rawData.data.length,
        latestDate: latest?.date,
        priceFormat: format,
        multiplier: format === 'thousands' ? '×1000' : '×1',
        latestPricesRaw: {
          open: latest?.open,
          high: latest?.high,
          low: latest?.low,
          close: latest?.close,  // THIS is what API returns
          adClose: latest?.adClose
        },
        latestPricesConverted: {
          open: latest?.open * (format === 'thousands' ? 1000 : 1),
          high: latest?.high * (format === 'thousands' ? 1000 : 1),
          low: latest?.low * (format === 'thousands' ? 1000 : 1),
          close: latest?.close * (format === 'thousands' ? 1000 : 1),  // THIS is what user will see
          adClose: latest?.adClose * (format === 'thousands' ? 1000 : 1)
        },
        hasAdjustedPrices: latest?.adOpen !== undefined
      })
    }

    // Normalize and validate the data
    const filteredByDate = (rawData.data || []).filter((item: any) => isValidTradingDate(item.date))

    console.log(`✓ After date filter: ${filteredByDate.length} records (latest: ${filteredByDate[0]?.date})`)

    const normalized = filteredByDate.map(normalizeStockPriceData)
    const validData = normalized.filter((item: any) => item !== null)

    // Log validation results
    if (filteredByDate.length !== validData.length) {
      const rejected = filteredByDate.length - validData.length
      console.warn(`⚠️ Rejected ${rejected}/${filteredByDate.length} records for ${code} due to OHLC validation`)

      // Check if LATEST record was rejected (this would cause wrong price display!)
      const latestNormalized = normalized[0]
      if (latestNormalized === null) {
        console.error(`🚨 CRITICAL: Latest record (${filteredByDate[0]?.date}) was REJECTED!`)
        console.error('Latest raw:', filteredByDate[0])
        console.error('This causes displaying OLD price instead of current price!')
      }
    }

    // Log what will actually be displayed to user (after sorting)
    if (validData.length > 0) {
      // Data is currently in DESC order (newest first), will be sorted ASC later
      const newestValid = validData[0]
      const oldestValid = validData[validData.length - 1]
      console.log(`✓ Valid data range: ${oldestValid?.date} to ${newestValid?.date}`)
      console.log(`✓ Latest valid price (will be displayed): close=${newestValid?.close}, adClose=${newestValid?.adClose}`)
    }

    const normalizedData = {
      ...rawData,
      data: validData
    }

    // If all data was filtered out, log warning
    if (validData.length === 0 && filteredByDate.length > 0) {
      console.error(`❌ All ${filteredByDate.length} records for ${code} were filtered out by validation!`)
      console.error('This might indicate overly strict validation or API data format changes')
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
