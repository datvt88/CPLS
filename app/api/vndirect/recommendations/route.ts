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
        reportPrice: 60.3,
        targetPrice: 79100.0,
        avgTargetPrice: 65206.98823529412
      },
      {
        code,
        firm: "HSC",
        type: "HOLD",
        reportDate: "2025-09-24",
        source: "BLOOMBERG",
        analyst: "Huong My Tran",
        reportPrice: 62.0,
        targetPrice: 64300.0,
        avgTargetPrice: 65206.98823529412
      },
      {
        code,
        firm: "Maybank IBG",
        type: "BUY",
        reportDate: "2025-09-17",
        source: "BLOOMBERG",
        analyst: "Nhan Tran Thi Thnah",
        reportPrice: 65.1,
        targetPrice: 75200.0,
        avgTargetPrice: 65206.98823529412
      },
      {
        code,
        firm: "VND",
        type: "BUY",
        reportDate: "2024-12-25",
        source: "VNDIRECT",
        analyst: "Hien Ha Thu",
        reportPrice: 64.4,
        targetPrice: 74.8,
        avgTargetPrice: 65206.98823529412
      }
    ],
    currentPage: 1,
    size: 100,
    totalElements: 4,
    totalPages: 1
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

    const data = await response.json()

    return NextResponse.json(data, {
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
