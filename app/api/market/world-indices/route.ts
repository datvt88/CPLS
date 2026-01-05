import { NextResponse } from 'next/server'
import type { WorldIndexData, VNDirectResponse } from '@/types/market'
import { buildVNDirectUrl, fetchVNDirectWithFallback } from '@/lib/vndirect-utils'

export async function GET() {
  const codes = 'DOWJONES,NASDAQ,NIKKEI225,SHANGHAI,HANGSENG,FTSE100,DAX'
  const url = buildVNDirectUrl('/v4/change_prices', {
    q: `period:1D~code:${codes}`
  })

  // Fallback data for when API is unavailable
  const fallbackData: VNDirectResponse<WorldIndexData> = {
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
  }

  const data = await fetchVNDirectWithFallback<VNDirectResponse<WorldIndexData>>(
    url,
    fallbackData,
    { next: { revalidate: 3 } } // Revalidate every 3 seconds
  )

  return NextResponse.json(data)
}
