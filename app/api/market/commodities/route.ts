import { NextResponse } from 'next/server'
import type { CommodityData, VNDirectResponse } from '@/types/market'
import { buildVNDirectUrl, fetchVNDirectWithFallback } from '@/lib/vndirect-utils'

export async function GET() {
  const codes = 'SPOT_GOLDS,GEN1ST_BRENT_OIL'
  const url = buildVNDirectUrl('/v4/change_prices', { 
    q: `period:1D~code:${codes}` 
  })

  // Fallback data for when API is unavailable
  const fallbackData: VNDirectResponse<CommodityData> = {
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
  }

  const data = await fetchVNDirectWithFallback<VNDirectResponse<CommodityData>>(
    url,
    fallbackData,
    { next: { revalidate: 3 } } // Revalidate every 3 seconds
  )

  return NextResponse.json(data)
}
