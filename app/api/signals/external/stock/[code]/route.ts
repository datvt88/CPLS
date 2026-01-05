import { NextResponse } from 'next/server'
import { fetchExternalApi, buildErrorResponse, getApiBaseUrl } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Validate API configuration
    getApiBaseUrl()

    const { code } = await params

    if (!code) {
      return buildErrorResponse('Stock code is required', 400)
    }

    const endpoint = `/api/v1/signals/stock/${code.toUpperCase()}`
    const data = await fetchExternalApi(endpoint)
    
    return NextResponse.json(data)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    
    // Check for 404 errors
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return buildErrorResponse('Stock not found', 404)
    }
    
    return buildErrorResponse(errorMessage, 500)
  }
}
