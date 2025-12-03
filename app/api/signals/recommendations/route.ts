import { NextRequest, NextResponse } from 'next/server'
import {
  getBuyRecommendations,
  saveBuyRecommendation,
  updateRecommendationStatus,
  calculatePerformanceMetrics,
  updateAllRecommendationsWithCurrentPrices
} from '@/services/goldenCross.service'

/**
 * GET /api/signals/recommendations
 * Get all buy recommendations with optional status filter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as 'active' | 'completed' | 'stopped' | null

    const recommendations = await getBuyRecommendations(status || undefined)

    return NextResponse.json({
      success: true,
      count: recommendations.length,
      data: recommendations
    })
  } catch (error) {
    console.error('Error fetching recommendations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/signals/recommendations
 * Save a new buy recommendation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      symbol,
      recommendedPrice,
      currentPrice,
      targetPrice,
      stopLoss,
      confidence,
      aiSignal,
      technicalAnalysis,
      fundamentalAnalysis,
      risks,
      opportunities
    } = body

    // Validate required fields
    if (!symbol || !recommendedPrice || !currentPrice || !confidence || !aiSignal) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const id = await saveBuyRecommendation({
      symbol,
      recommendedPrice,
      currentPrice,
      targetPrice,
      stopLoss,
      confidence,
      aiSignal,
      technicalAnalysis: technicalAnalysis || [],
      fundamentalAnalysis: fundamentalAnalysis || [],
      risks: risks || [],
      opportunities: opportunities || []
    })

    return NextResponse.json({
      success: true,
      id,
      message: 'Buy recommendation saved successfully'
    })
  } catch (error) {
    console.error('Error saving recommendation:', error)
    return NextResponse.json(
      { error: 'Failed to save recommendation' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/signals/recommendations/:id
 * Update recommendation status and current price
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, currentPrice, status } = body

    if (!id || !currentPrice) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await updateRecommendationStatus(id, currentPrice, status)

    return NextResponse.json({
      success: true,
      message: 'Recommendation updated successfully'
    })
  } catch (error) {
    console.error('Error updating recommendation:', error)
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/signals/recommendations/performance
 * Get performance metrics for all recommendations
 */
export async function GET_PERFORMANCE(request: NextRequest) {
  try {
    const metrics = await calculatePerformanceMetrics()

    return NextResponse.json({
      success: true,
      data: metrics
    })
  } catch (error) {
    console.error('Error calculating performance:', error)
    return NextResponse.json(
      { error: 'Failed to calculate performance metrics' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/signals/recommendations/update-prices
 * Update all active recommendations with current market prices
 */
export async function POST_UPDATE_PRICES(request: NextRequest) {
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
