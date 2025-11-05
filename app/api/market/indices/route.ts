import { NextResponse } from 'next/server'
import type { IndexData, VNDirectResponse } from '@/types/market'

export async function GET() {
  try {
    const codes = 'VNINDEX,HNX,UPCOM,VN30,VN30F1M'
    const url = `https://api-finfo.vndirect.com.vn/v4/change_prices?q=code:${codes}~period:1D`

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

    const data: VNDirectResponse<IndexData> = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching indices:', error)

    // Return mock data as fallback
    return NextResponse.json({
      data: [
        {
          code: 'VNINDEX',
          lastPrice: 1250.45,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: 5.23,
          priceChgPctCr1D: 0.42,
          highPrice: 1255.30,
          lowPrice: 1245.10,
          openPrice: 1247.20,
        },
        {
          code: 'HNX',
          lastPrice: 235.67,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: -2.15,
          priceChgPctCr1D: -0.90,
          highPrice: 238.50,
          lowPrice: 234.20,
          openPrice: 237.80,
        },
      ],
    })
  }
}
