import { NextRequest, NextResponse } from 'next/server'

// Development mock data fallback
function generateMockRatios(code: string) {
  return [
    { value: 2.0531871162125E14, ratioCode: 'MARKETCAP' },
    { value: 2.79847917E7, ratioCode: 'NMVOLUME_AVG_CR_10D' },
    { value: 30350.0, ratioCode: 'PRICE_HIGHEST_CR_52W' },
    { value: 17749.0, ratioCode: 'PRICE_LOWEST_CR_52W' },
    { value: 7.675465855E9, ratioCode: 'OUTSTANDING_SHARES' },
    { value: 0.6077503096390232, ratioCode: 'FREEFLOAT' },
    { value: 1.1390154356678337, ratioCode: 'BETA' },
    { value: 14.260486175627856, ratioCode: 'PRICE_TO_EARNINGS' },
    { value: 1.6368184900074352, ratioCode: 'PRICE_TO_BOOK' },
    { value: 0.0, ratioCode: 'DIVIDEND_YIELD' },
    { value: 16342.679511079135, ratioCode: 'BVPS_CR' },
    { value: 0.1211320978931443, ratioCode: 'ROAE_TR_AVG5Q' },
    { value: 0.062428745865153325, ratioCode: 'ROAA_TR_AVG5Q' },
    { value: 1875.812624517499, ratioCode: 'EPS_TR' },
  ]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json(
      { error: 'Missing stock code parameter' },
      { status: 400 }
    )
  }

  try {
    const ratios = [
      'MARKETCAP',
      'NMVOLUME_AVG_CR_10D',
      'PRICE_HIGHEST_CR_52W',
      'PRICE_LOWEST_CR_52W',
      'OUTSTANDING_SHARES',
      'FREEFLOAT',
      'BETA',
      'PRICE_TO_EARNINGS',
      'PRICE_TO_BOOK',
      'DIVIDEND_YIELD',
      'BVPS_CR',
      'ROAE_TR_AVG5Q',
      'ROAA_TR_AVG5Q',
      'EPS_TR'
    ]

    const filter = ratios.join(',')
    const url = `https://api-finfo.vndirect.com.vn/v4/ratios/latest?filter=ratioCode:${filter}&where=code:${code.toUpperCase()}&order=reportDate&fields=ratioCode,value`

    console.log('🔄 Proxy fetching ratios from VNDirect:', url)

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://dstock.vndirect.com.vn/',
        'Origin': 'https://dstock.vndirect.com.vn',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour (financial data changes less frequently)
    })

    console.log('✅ VNDirect Ratios API response status:', response.status)

    if (!response.ok) {
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (error) {
    console.error('⚠️ VNDirect API unavailable, using mock data for development:', error)

    // Return mock data for development/testing when API is unavailable
    const mockData = {
      data: generateMockRatios(code),
    }

    return NextResponse.json(mockData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'X-Mock-Data': 'true', // Indicator that this is mock data
      },
    })
  }
}
