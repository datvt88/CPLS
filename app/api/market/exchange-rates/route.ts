import { NextResponse } from 'next/server'
import type { ExchangeRateData, VNDirectResponse } from '@/types/market'
import { buildVNDirectUrl, fetchVNDirectWithFallback } from '@/lib/vndirect-utils'

export async function GET() {
  const url = buildVNDirectUrl('/v4/currencies/latest', {
    order: 'tradingDate',
    where: 'locale:VN',
    filter: 'code:USD_VND,EUR_VND,CNY_VND,JPY_VND,EUR_USD,USD_JPY,USD_CNY'
  })

  // Fallback data for when API is unavailable
  const fallbackData: VNDirectResponse<ExchangeRateData> = {
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
  }

  const data = await fetchVNDirectWithFallback<VNDirectResponse<ExchangeRateData>>(
    url,
    fallbackData,
    { next: { revalidate: 3 } } // Revalidate every 3 seconds
  )

  return NextResponse.json(data)
}
