import { NextResponse } from 'next/server'
import { fetchExternalApi, buildErrorResponse, getApiBaseUrl } from '@/lib/api-utils'
import type { NextFetchRequestInit } from '@/lib/fetch-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    // Validate API configuration
    getApiBaseUrl()

    const { searchParams } = new URL(request.url)

    // Build query string from search params
    const params = new URLSearchParams()
    searchParams.forEach((value, key) => {
      params.append(key, value)
    })

    const queryString = params.toString()
    const endpoint = `/api/v1/signals${queryString ? `?${queryString}` : ''}`

    const data = await fetchExternalApi(endpoint)
    return NextResponse.json(data)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return buildErrorResponse(errorMessage, 500)
  }
}
