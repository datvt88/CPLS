import { NextRequest, NextResponse } from 'next/server'
import { getGoldenCrossStocks } from '@/services/goldenCross.service'

/**
 * GET /api/signals/golden-cross
 * Fetch golden cross stocks from Firebase
 */
export async function GET(request: NextRequest) {
  try {
    const stocks = await getGoldenCrossStocks()

    return NextResponse.json({
      success: true,
      count: stocks.length,
      data: stocks
    })
  } catch (error) {
    console.error('Error fetching golden cross stocks:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch golden cross stocks'
      },
      { status: 500 }
    )
  }
}
