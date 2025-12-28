import { NextResponse } from 'next/server'

const API_BASE_URL = 'https://cpls-be-230198333889.asia-southeast1.run.app/api/v1'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/signals/top`, {
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
    console.error('Error fetching top signals:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
