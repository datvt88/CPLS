import { NextResponse } from 'next/server'
import { fetchExternalApi, buildErrorResponse, getApiBaseUrl } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    // Validate API configuration
    getApiBaseUrl()

    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '20'

    const endpoint = `/api/v1/signals/indicators?page=${page}&limit=${limit}`
    const data = await fetchExternalApi(endpoint)
    
    return NextResponse.json(data)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return buildErrorResponse(errorMessage, 500)
  }
}
