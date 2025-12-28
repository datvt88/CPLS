import { NextResponse } from 'next/server'

const API_BASE_URL = 'https://cpls-be-230198333889.asia-southeast1.run.app/api/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_TYPES = ['buy', 'sell', 'momentum', 'oversold', 'breakout']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '20'

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid screener type' },
        { status: 400 }
      )
    }

    const response = await fetch(`${API_BASE_URL}/signals/screener/${type}?limit=${limit}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
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
    console.error('Error fetching screener results:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
