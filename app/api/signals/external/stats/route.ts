import { NextResponse } from 'next/server'
import { fetchExternalApi, buildErrorResponse, getApiBaseUrl } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Validate API configuration
    getApiBaseUrl()

    const data = await fetchExternalApi('/api/v1/signals/stats')
    return NextResponse.json(data)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return buildErrorResponse(errorMessage, 500)
  }
}
