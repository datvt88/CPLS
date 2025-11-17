import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - disable all caching for real-time recommendation data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Development mock data fallback
function generateMockRecommendations(code: string) {
  return {
    data: [
      {
        code,
        firm: "MASC",
        type: "BUY",
        reportDate: "2025-09-29",
        source: "BLOOMBERG",
        analyst: "Chau Bui",
        reportPrice: 60300,
        targetPrice: 79100,
        avgTargetPrice: 65207
      },
      {
        code,
        firm: "HSC",
        type: "HOLD",
        reportDate: "2025-09-24",
        source: "BLOOMBERG",
        analyst: "Huong My Tran",
        reportPrice: 62000,
        targetPrice: 64300,
        avgTargetPrice: 65207
      },
      {
        code,
        firm: "Maybank IBG",
        type: "BUY",
        reportDate: "2025-09-17",
        source: "BLOOMBERG",
        analyst: "Nhan Tran Thi Thnah",
        reportPrice: 65100,
        targetPrice: 75200,
        avgTargetPrice: 65207
      },
      {
        code,
        firm: "VND",
        type: "BUY",
        reportDate: "2024-12-25",
        source: "VNDIRECT",
        analyst: "Hien Ha Thu",
        reportPrice: 64400,
        targetPrice: 74800,
        avgTargetPrice: 65207
      }
    ],
    currentPage: 1,
    size: 100,
    totalElements: 4,
    totalPages: 1
  }
}

/**
 * Detect if prices are in thousands format
 * VN stock prices typically range from 10,000 - 200,000 VND
 * If all prices are < 1000, they're likely in thousands format
 */
function detectPriceFormat(rec: any): 'thousands' | 'vnd' {
  const prices = [rec.reportPrice, rec.targetPrice, rec.avgTargetPrice]
    .filter(p => p !== null && p !== undefined && !isNaN(Number(p)))
    .map(p => Number(p))

  if (prices.length === 0) return 'vnd'

  // If ALL prices are < 1000, assume thousands format
  // If ANY price is >= 1000, assume VND format
  const allUnder1000 = prices.every(p => p < 1000)
  const anyOver10000 = prices.some(p => p >= 10000)

  if (anyOver10000) return 'vnd' // Clearly in VND
  if (allUnder1000) return 'thousands' // Clearly in thousands

  // Mixed case - use heuristic: if average > 5000, likely VND
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  return avg > 5000 ? 'vnd' : 'thousands'
}

/**
 * Normalize a single price value
 */
function normalizePrice(price: number | null | undefined, format: 'thousands' | 'vnd'): number | undefined {
  if (price === null || price === undefined || isNaN(Number(price))) {
    return undefined
  }

  const numPrice = Number(price)

  // If price is 0 or negative, invalid
  if (numPrice <= 0) return undefined

  // Convert based on detected format
  return format === 'thousands' ? numPrice * 1000 : numPrice
}

/**
 * Normalize recommendation data from VNDirect API
 * Ensures prices are in consistent format (VND)
 */
function normalizeRecommendation(rec: any) {
  // Detect format for this recommendation
  const format = detectPriceFormat(rec)

  return {
    code: rec.code || '',
    firm: rec.firm || '',
    type: rec.type || 'HOLD',
    reportDate: rec.reportDate || '',
    source: rec.source || '',
    analyst: rec.analyst || '',
    reportPrice: normalizePrice(rec.reportPrice, format),
    targetPrice: normalizePrice(rec.targetPrice, format) || 0,
    avgTargetPrice: normalizePrice(rec.avgTargetPrice, format) || 0,
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const size = searchParams.get('size') || '100'
  const startDate = searchParams.get('startDate')

  if (!code) {
    return NextResponse.json(
      { error: 'Missing stock code parameter' },
      { status: 400 }
    )
  }

  try {
    // Build query parameters
    let query = `code:${code.toUpperCase()}`

    // Add date filter if provided
    if (startDate) {
      query += `~reportDate:gte:${startDate}`
    }

    const url = `https://api-finfo.vndirect.com.vn/v4/recommendations?q=${encodeURIComponent(query)}&size=${size}&sort=reportDate:DESC`

    console.log('🔄 Proxy fetching recommendations from VNDirect:', url)

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://dstock.vndirect.com.vn/',
        'Origin': 'https://dstock.vndirect.com.vn',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour (recommendations change less frequently)
    })

    console.log('✅ VNDirect Recommendations API response status:', response.status)

    if (!response.ok) {
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    const rawData = await response.json()

    // Normalize the data
    const normalizedData = {
      ...rawData,
      data: rawData.data?.map(normalizeRecommendation) || []
    }

    return NextResponse.json(normalizedData, {
      headers: {
        // Disable caching to ensure fresh recommendation data
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('⚠️ VNDirect API unavailable, using mock data for development:', error)

    // Return mock data for development/testing when API is unavailable
    const mockData = generateMockRecommendations(code)

    return NextResponse.json(mockData, {
      headers: {
        // Mock data also shouldn't be cached
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Mock-Data': 'true',
      },
    })
  }
}
