import { NextResponse } from 'next/server'
import { fetchExternalApi, buildErrorResponse, getApiBaseUrl } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_TYPES = ['buy', 'sell', 'momentum', 'oversold', 'breakout']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    // Validate API configuration
    getApiBaseUrl()

    const { type } = await params
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '20'

    if (!VALID_TYPES.includes(type)) {
      return buildErrorResponse('Invalid screener type', 400)
    }

    const endpoint = `/api/v1/signals/screener/${type}?limit=${limit}`
    const data = await fetchExternalApi(endpoint)
    
    return NextResponse.json(data)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return buildErrorResponse(errorMessage, 500)
  }
}
