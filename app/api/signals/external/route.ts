import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.SIGNAL_API_URL || process.env.NEXT_PUBLIC_API_URL
const REVALIDATE_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REVALIDATE_INTERVAL || '60', 10)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { success: false, error: 'API URL not configured' },
      { status: 500 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)

    // Build query string from search params
    const params = new URLSearchParams()
    searchParams.forEach((value, key) => {
      params.append(key, value)
    })

    const url = `${API_BASE_URL}/api/v1/signals${params.toString() ? `?${params.toString()}` : ''}`

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: REVALIDATE_INTERVAL },
    })

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching signals:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
