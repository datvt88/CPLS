import { NextRequest, NextResponse } from 'next/server'
import { updateAllRecommendationsWithCurrentPrices } from '@/services/recommendations.service'

/**
 * POST /api/signals/recommendations/update-prices
 * Update all active recommendations with current market prices
 */
export async function POST(request: NextRequest) {
  try {
    await updateAllRecommendationsWithCurrentPrices()

    return NextResponse.json({
      success: true,
      message: 'All active recommendations updated with current prices'
    })
  } catch (error) {
    console.error('Error updating prices:', error)
    return NextResponse.json(
      { error: 'Failed to update prices' },
      { status: 500 }
    )
  }
}
