import { NextResponse } from 'next/server'
import type { IndexData, VNDirectResponse } from '@/types/market'
import { buildVNDirectUrl, fetchVNDirectWithFallback } from '@/lib/vndirect-utils'

export async function GET() {
  const codes = 'VNINDEX,HNX,UPCOM,VN30,VN30F1M'
  const url = buildVNDirectUrl('/v4/change_prices', {
    q: `code:${codes}~period:1D`
  })

  // Fallback data for when API is unavailable
  const fallbackData: VNDirectResponse<IndexData> = {
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
  }

  const data = await fetchVNDirectWithFallback<VNDirectResponse<IndexData>>(
    url,
    fallbackData,
    { next: { revalidate: 3 } } // Revalidate every 3 seconds
  )

  return NextResponse.json(data)
}
