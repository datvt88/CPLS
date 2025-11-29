import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * DNSE Equity Structure API Proxy
 * Fetches equity structure data for Vietnamese stocks
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')
    const code = searchParams.get('code') || 'OWNERS_EQUITY'
    const cycleType = searchParams.get('cycleType') || 'quy'
    const cycleNumber = searchParams.get('cycleNumber') || '5'

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      )
    }

    console.log('📊 Fetching equity structure from DNSE for:', symbol)

    // Call DNSE API
    const url = `https://api-bo.dnse.com.vn/senses-api/financial-report/details?symbol=${symbol}&code=${code}&cycleType=${cycleType}&cycleNumber=${cycleNumber}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.error('DNSE API error:', response.status, response.statusText)
      return NextResponse.json(
        { error: `DNSE API returned ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Equity structure data fetched successfully')

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error fetching equity structure:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equity structure data' },
      { status: 500 }
    )
  }
}
