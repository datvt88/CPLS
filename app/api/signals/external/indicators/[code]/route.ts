import { NextResponse } from 'next/server'

const API_BASE_URL = process.env.SIGNAL_API_URL || process.env.NEXT_PUBLIC_API_URL
const REVALIDATE_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REVALIDATE_INTERVAL || '60', 10)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!API_BASE_URL) {
    return NextResponse.json(
      { success: false, error: 'API URL not configured' },
      { status: 500 }
    )
  }

  try {
    const { code } = await params

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Stock code is required' },
        { status: 400 }
      )
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/signals/indicators/${code.toUpperCase()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: REVALIDATE_INTERVAL },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { success: false, error: 'Stock indicators not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { success: false, error: `API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error fetching stock indicators:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
