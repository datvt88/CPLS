import { NextResponse } from 'next/server'
import type { WorldIndexData, VNDirectResponse } from '@/types/market'

export async function GET() {
  try {
    const codes = 'DOWJONES,NASDAQ,NIKKEI225,SHANGHAI,HANGSENG,FTSE100,DAX'
    const url = `https://api-finfo.vndirect.com.vn/v4/change_prices?q=period:1D~code:${codes}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 3 }, // Revalidate every 3 seconds
    })

    if (!response.ok) {
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    const data: VNDirectResponse<WorldIndexData> = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching world indices:', error)

    // Return mock data as fallback
    return NextResponse.json({
      data: [
        {
          code: 'DOWJONES',
          lastPrice: 34567.89,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: 125.45,
          priceChgPctCr1D: 0.36,
        },
        {
          code: 'NASDAQ',
          lastPrice: 13567.23,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: -45.67,
          priceChgPctCr1D: -0.34,
        },
      ],
    })
  }
}
