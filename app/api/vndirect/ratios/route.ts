import { NextRequest, NextResponse } from 'next/server'

// Development mock data fallback
function generateMockRatios(code: string) {
  const ratioConfigs = [
    { ratioCode: 'MARKETCAP', name: 'Market Capitalization', value: 150000000000000, unit: 'VND' },
    { ratioCode: 'PE', name: 'P/E Ratio', value: 15.5, unit: '' },
    { ratioCode: 'PB', name: 'P/B Ratio', value: 2.3, unit: '' },
    { ratioCode: 'PS', name: 'P/S Ratio', value: 1.8, unit: '' },
    { ratioCode: 'BETA', name: 'Beta', value: 0.95, unit: '' },
    { ratioCode: 'EPS', name: 'Earnings Per Share', value: 5200, unit: 'VND' },
    { ratioCode: 'BVPS', name: 'Book Value Per Share', value: 35000, unit: 'VND' },
    { ratioCode: 'ROAE', name: 'Return on Equity', value: 18.5, unit: '%' },
    { ratioCode: 'ROAA', name: 'Return on Assets', value: 12.3, unit: '%' },
    { ratioCode: 'DIVIDEND', name: 'Dividend Yield', value: 3.2, unit: '%' },
    { ratioCode: 'PAYOUTRATIO', name: 'Payout Ratio', value: 45.0, unit: '%' },
    { ratioCode: 'EBITDA', name: 'EBITDA', value: 25000000000000, unit: 'VND' },
    { ratioCode: 'EVEBITDA', name: 'EV/EBITDA', value: 8.5, unit: '' },
    { ratioCode: 'DEBTEQUITY', name: 'Debt to Equity', value: 0.65, unit: '' },
    { ratioCode: 'QUICKRATIO', name: 'Quick Ratio', value: 1.2, unit: '' },
    { ratioCode: 'CURRENTRATIO', name: 'Current Ratio', value: 1.8, unit: '' },
    { ratioCode: 'GROSSPROFITMARGIN', name: 'Gross Profit Margin', value: 35.5, unit: '%' },
    { ratioCode: 'NETPROFITMARGIN', name: 'Net Profit Margin', value: 15.2, unit: '%' },
    { ratioCode: 'ASSETTURNOVER', name: 'Asset Turnover', value: 0.8, unit: '' },
    { ratioCode: 'INVENTORYTURNOVER', name: 'Inventory Turnover', value: 6.5, unit: '' },
  ]

  return ratioConfigs.map(config => ({
    ...config,
    code: code.toUpperCase(),
    icbName: 'Technology',
    icbCode: '10',
  }))
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
      'PE',
      'PB',
      'PS',
      'BETA',
      'EPS',
      'BVPS',
      'ROAE',
      'ROAA',
      'DIVIDEND',
      'PAYOUTRATIO',
      'EBITDA',
      'EVEBITDA',
      'DEBTEQUITY',
      'QUICKRATIO',
      'CURRENTRATIO',
      'GROSSPROFITMARGIN',
      'NETPROFITMARGIN',
      'ASSETTURNOVER',
      'INVENTORYTURNOVER'
    ]

    const filter = ratios.map(r => `ratioCode:${r}`).join(',')
    const url = `https://api-finfo.vndirect.com.vn/v4/ratios/latest?filter=${filter}&where=code:${code.toUpperCase()}`

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
