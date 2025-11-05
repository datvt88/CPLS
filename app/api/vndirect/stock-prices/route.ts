import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const size = searchParams.get('size') || '270'

  if (!code) {
    return NextResponse.json(
      { error: 'Missing stock code parameter' },
      { status: 400 }
    )
  }

  try {
    const url = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${code.toUpperCase()}&size=${size}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Error fetching stock prices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock prices', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
