import { NextResponse } from 'next/server'
import type { ExchangeRateData, VNDirectResponse } from '@/types/market'

export async function GET() {
  try {
    const codes = 'USD_VND,EUR_VND,JPY_VND,GBP_VND,AUD_VND,CNY_VND,SGD_VND,THB_VND'
    const url = `https://api-finfo.vndirect.com.vn/v4/currencies/latest?order=tradingDate&where=locale:VN&filter=code:${codes}`

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
          locale: 'VN',
          tradingDate: new Date().toISOString(),
          buyRate: 23450,
          sellRate: 23850,
          lastUpdated: new Date().toISOString(),
        },
        {
          code: 'EUR_VND',
          locale: 'VN',
          tradingDate: new Date().toISOString(),
          buyRate: 25300,
          sellRate: 25800,
          lastUpdated: new Date().toISOString(),
        },
      ],
    })
  }
}
