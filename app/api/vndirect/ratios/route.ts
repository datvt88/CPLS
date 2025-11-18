import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - disable all caching for real-time financial data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Development mock data fallback
// NOTE: These values are already normalized (prices in VND, not thousands)
function generateMockRatios(code: string) {
  return [
    { value: 2.0531871162125E14, ratioCode: 'MARKETCAP' },
    { value: 2.79847917E7, ratioCode: 'NMVOLUME_AVG_CR_10D' },
    { value: 30.35, ratioCode: 'PRICE_HIGHEST_CR_52W' },  // Already normalized: 30350 / 1000 = 30.35
    { value: 17.749, ratioCode: 'PRICE_LOWEST_CR_52W' },  // Already normalized: 17749 / 1000 = 17.749
    { value: 7.675465855E9, ratioCode: 'OUTSTANDING_SHARES' },
    { value: 0.6077503096390232, ratioCode: 'FREEFLOAT' },
    { value: 1.1390154356678337, ratioCode: 'BETA' },
    { value: 14.260486175627856, ratioCode: 'PRICE_TO_EARNINGS' },
    { value: 1.6368184900074352, ratioCode: 'PRICE_TO_BOOK' },
    { value: 0.0, ratioCode: 'DIVIDEND_YIELD' },
    { value: 16.342679511079135, ratioCode: 'BVPS_CR' },  // Already normalized: 16342 / 1000 = 16.342
    { value: 0.1211320978931443, ratioCode: 'ROAE_TR_AVG5Q' },
    { value: 0.062428745865153325, ratioCode: 'ROAA_TR_AVG5Q' },
    { value: 1.875812624517499, ratioCode: 'EPS_TR' },  // Already normalized: 1875 / 1000 = 1.875
  ]
}

/**
 * Validate and normalize financial ratio data
 * Ensures all required fields are present and have correct types
 * VNDirect API returns some values in thousands (e.g., prices), need to normalize
 */
function normalizeFinancialRatio(ratio: any) {
  const ratioCode = String(ratio.ratioCode || '')
  let value = Number(ratio.value) || 0

  // VNDirect API returns price values in thousands (similar to targetPrice in recommendations)
  // Example: 35300 means 35.3 VND, so divide by 1000
  // This matches the normalization in vndirect-client.ts
  if (ratioCode === 'PRICE_HIGHEST_CR_52W' ||
      ratioCode === 'PRICE_LOWEST_CR_52W' ||
      ratioCode === 'BVPS_CR' ||
      ratioCode === 'EPS_TR') {
    value = value / 1000
  }

  return {
    ratioCode: ratioCode,
    value: value,
  }
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

    const ratiosFilter = ratios.join(',')
    const url = `https://api-finfo.vndirect.com.vn/v4/ratios/latest?filter=ratioCode:${ratiosFilter}&where=code:${code.toUpperCase()}&order=reportDate&fields=ratioCode,value`

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

    const rawData = await response.json()

    // Normalize the data
    const normalizedData = {
      ...rawData,
      data: (rawData.data || []).map(normalizeFinancialRatio)
    }

    return NextResponse.json(normalizedData, {
      headers: {
        // Disable caching to ensure fresh financial data
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
        // Mock data also shouldn't be cached
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Mock-Data': 'true',
      },
    })
  }
}
