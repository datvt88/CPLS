import { NextRequest, NextResponse } from 'next/server'

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
 * Normalize recommendation data from VNDirect API
 * Ensures prices are in consistent format (VND)
 */
function normalizeRecommendation(rec: any) {
  return {
    code: rec.code || '',
    firm: rec.firm || '',
    type: rec.type || 'HOLD',
    reportDate: rec.reportDate || '',
    source: rec.source || '',
    analyst: rec.analyst || '',
    // Normalize prices: if < 1000, assume it's in thousands and convert to VND
    reportPrice: rec.reportPrice
      ? (rec.reportPrice < 1000 ? rec.reportPrice * 1000 : rec.reportPrice)
      : undefined,
    targetPrice: rec.targetPrice
      ? (rec.targetPrice < 1000 ? rec.targetPrice * 1000 : rec.targetPrice)
      : 0,
    avgTargetPrice: rec.avgTargetPrice
      ? (rec.avgTargetPrice < 1000 ? rec.avgTargetPrice * 1000 : rec.avgTargetPrice)
      : 0,
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
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (error) {
    console.error('⚠️ VNDirect API unavailable, using mock data for development:', error)

    // Return mock data for development/testing when API is unavailable
    const mockData = generateMockRecommendations(code)

    return NextResponse.json(mockData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Mock-Data': 'true', // Indicator that this is mock data
      },
    })
  }
}
