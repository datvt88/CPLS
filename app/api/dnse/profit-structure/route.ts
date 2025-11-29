import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - disable all caching for real-time financial data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const symbol = searchParams.get('symbol') || 'VNM'
    const code = searchParams.get('code') || 'PROFIT_BEFORE_TAX'
    const cycleType = searchParams.get('cycleType') || 'quy'
    const cycleNumber = searchParams.get('cycleNumber') || '5'

    console.log('📊 Fetching DNSE profit structure data for:', symbol)

    const url = `https://api-bo.dnse.com.vn/senses-api/financial-report/details?symbol=${symbol}&code=${code}&cycleType=${cycleType}&cycleNumber=${cycleNumber}`

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!response.ok) {
      throw new Error(`DNSE API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ DNSE profit structure data loaded')

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error fetching DNSE profit structure data:', error)

    // Return mock data as fallback
    return NextResponse.json({
      x: ['Q3/2024', 'Q4/2024', 'Q1/2025', 'Q2/2025', 'Q3/2025'],
      type: 'stackedbar-markupline',
      data: [
        {
          id: 0,
          label: 'LN trước thuế',
          type: 'line',
          tooltip: 'Lợi nhuận trước thuế là khoản lợi nhuận của doanh nghiệp sau khi đã trừ đi các khoản chi phí',
          y: [2941801640478, 2643368770905, 1951296195523, 3096088533277, 3125600614052],
          yAxisPosition: 'left',
        },
        {
          id: 1,
          label: 'LN kinh doanh',
          type: 'bar',
          tooltip: 'Là lợi nhuận thuần từ hoạt động kinh doanh. LN kinh doanh = LN trước thuế - LN tài chính - LN LDLK - LN khác',
          y: [2643293478851, 2303998481007, 1609795815116, 2848052508009, 3047758786457],
          yAxisPosition: 'left',
        },
        {
          id: 2,
          label: 'LN tài chính',
          type: 'bar',
          tooltip: 'Lợi nhuận từ hoạt động đầu tư tài chính',
          y: [332514058311, 254524734881, 324571847165, 266785468327, 304485909316],
          yAxisPosition: 'left',
        },
        {
          id: 3,
          label: 'LN liên doanh, liên kết',
          type: 'bar',
          tooltip: 'Lợi nhuận từ hoạt động góp vốn, công ty liên doanh, liên kết',
          y: [-5059420447, 23396009808, 16189054400, 3760327370, -194491871698],
          yAxisPosition: 'left',
        },
        {
          id: 4,
          label: 'LN khác',
          type: 'bar',
          tooltip: 'Lợi nhuận từ các hoạt động khác không phải hoạt động sản xuất kinh doanh thông thường, hoạt động tài chính',
          y: [-28946476237, 61449545209, 739478842, -22509770429, -32152210023],
          yAxisPosition: 'left',
        },
      ],
    })
  }
}
