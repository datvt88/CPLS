import { NextResponse } from 'next/server'
import type { ExchangeRateData, VNDirectResponse } from '@/types/market'

export async function GET() {
  try {
    const codes = 'USD_VND,EUR_VND,JPY_VND,CNY_VND'
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

    const data: VNDirectResponse<ExchangeRateData> = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching exchange rates:', error)

    // Return mock data as fallback
    return NextResponse.json({
      data: [
        {
          code: 'USD_VND',
          name: 'USD/VND',
          type: 'CURRENCY',
          period: '1D',
          price: 25577.0,
          bopPrice: 25577.0,
          change: 0.0,
          changePct: 0.0,
          lastUpdated: new Date().toISOString(),
        },
        {
          code: 'EUR_VND',
          name: 'EUR/VND',
          type: 'CURRENCY',
          period: '1D',
          price: 27704.0,
          bopPrice: 27788.0,
          change: -84.0,
          changePct: -0.3,
          lastUpdated: new Date().toISOString(),
        },
      ],
    })
  }
}
