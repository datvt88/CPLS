import { NextResponse } from 'next/server'
import { fetchExternalApi, buildErrorResponse, getApiBaseUrl, getRevalidateInterval } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Validate API configuration
    getApiBaseUrl()

    // Cache longer for strategies (5x the normal interval)
    const data = await fetchExternalApi('/api/v1/signals/strategies', {
      next: { revalidate: getRevalidateInterval() * 5 },
    })
    
    return NextResponse.json(data)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return buildErrorResponse(errorMessage, 500)
  }
}
