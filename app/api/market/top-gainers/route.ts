import { NextResponse } from 'next/server'
import type { TopGainerStock, VNDirectResponse } from '@/types/market'

export async function GET() {
  try {
    const url = 'https://api-finfo.vndirect.com.vn/v4/top_stocks?q=index:VNIndex~lastPrice:gte:6~nmVolumeAvgCr20D:gte:100000~priceChgPctCr1D:gt:0&size=10&sort=priceChgPctCr1D'

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

    const data: VNDirectResponse<TopGainerStock> = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching top gainers:', error)

    // Return mock data as fallback
    return NextResponse.json({
      data: [
        {
          code: 'HPG',
          index: 'VNINDEX',
          lastPrice: 28.5,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: 1.8,
          priceChgPctCr1D: 6.74,
          accumulatedVal: 450000000000,
          nmVolumeAvgCr20D: 15000000,
        },
        {
          code: 'VNM',
          index: 'VNINDEX',
          lastPrice: 85.2,
          lastUpdated: new Date().toISOString(),
          priceChgCr1D: 5.3,
          priceChgPctCr1D: 6.62,
          accumulatedVal: 380000000000,
          nmVolumeAvgCr20D: 8500000,
        },
      ],
    })
  }
}
