import { NextResponse } from 'next/server'
import type { CommodityData, VNDirectResponse } from '@/types/market'

export async function GET() {
  try {
    const codes = 'SPOT_GOLDS,GEN1ST_BRENT_OIL'
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

    const data: VNDirectResponse<CommodityData> = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching commodities:', error)

    // Return mock data as fallback
    return NextResponse.json({
      data: [
        {
          code: 'SPOT_GOLDS',
          lastPrice: 1945.50,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: 12.30,
          priceChgPctCr1D: 0.64,
          unit: 'USD/oz',
        },
        {
          code: 'GEN1ST_BRENT_OIL',
          lastPrice: 85.67,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: -1.25,
          priceChgPctCr1D: -1.44,
          unit: 'USD/barrel',
        },
      ],
    })
  }
}
