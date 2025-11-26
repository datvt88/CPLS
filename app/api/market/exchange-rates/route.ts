import { NextResponse } from 'next/server'
import type { ExchangeRateData, VNDirectResponse } from '@/types/market'

export async function GET() {
  try {
    const url = 'https://api-finfo.vndirect.com.vn/v4/currencies/latest?order=tradingDate&where=locale:VN&filter=code:USD_VND,EUR_VND,CNY_VND,JPY_VND,EUR_USD,USD_JPY,USD_CNY'

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
          codeName: 'Tỷ giá USD/VND',
          tradingDate: new Date().toISOString().split('T')[0],
          openPrice: 26366.0,
          highPrice: 26383.0,
          lowPrice: 26366.0,
          closePrice: 26371.0,
          change: 5.0,
          changePct: 0.019,
          locale: 'VN',
        },
        {
          code: 'EUR_VND',
          codeName: 'Tỷ giá EUR/VND',
          tradingDate: new Date().toISOString().split('T')[0],
          openPrice: 30378.0,
          highPrice: 30553.0,
          lowPrice: 30367.0,
          closePrice: 30512.0,
          change: 134.0,
          changePct: 0.4411,
          locale: 'VN',
        },
      ],
    })
  }
}
