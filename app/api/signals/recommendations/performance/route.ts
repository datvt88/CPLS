import { NextRequest, NextResponse } from 'next/server'
import { calculatePerformanceMetrics } from '@/services/recommendations.service'

/**
 * GET /api/signals/recommendations/performance
 * Get performance metrics for all recommendations
 */
export async function GET(request: NextRequest) {
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
