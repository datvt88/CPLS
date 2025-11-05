import { NextRequest, NextResponse } from 'next/server'

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

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour (financial data changes less frequently)
    })

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
    console.error('Error fetching financial ratios:', error)
    return NextResponse.json(
      { error: 'Failed to fetch financial ratios', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
