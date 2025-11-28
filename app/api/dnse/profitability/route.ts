import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering - disable all caching for real-time financial data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const symbol = searchParams.get('symbol') || 'VNM'
    const code = searchParams.get('code') || 'PROFITABLE_EFFICIENCY'
    const cycleType = searchParams.get('cycleType') || 'quy'
    const cycleNumber = searchParams.get('cycleNumber') || '5'

    console.log('📊 Fetching DNSE profitability data for:', symbol)

    const url = `https://api-bo.dnse.com.vn/senses-api/business-result?symbol=${symbol}&code=${code}&cycleType=${cycleType}&cycleNumber=${cycleNumber}`

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
    console.log('✅ DNSE profitability data loaded')

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error fetching DNSE profitability data:', error)

    // Return mock data as fallback
    return NextResponse.json({
      x: ['Q3/2024', 'Q4/2024', 'Q1/2025', 'Q2/2025', 'Q3/2025'],
      type: 'line',
      unit: '%',
      data: [
        {
          id: 0,
          label: 'ROE',
          tooltip: 'Là chỉ số tỷ suất lợi nhuận ròng trên vốn chủ sở hữu, đo lường khả năng sinh lợi trên mỗi đồng vốn chủ',
          type: 'line',
          y: [27.89, 26.55, 24.04, 23.31, 23.86],
          yAxisPosition: 'left',
        },
        {
          id: 1,
          label: 'ROA',
          tooltip: 'Là chỉ số tỷ suất lợi nhuận ròng trên tài sản, đo lường khả năng sinh lời trên mỗi đồng tài sản',
          type: 'line',
          y: [17.15, 17.55, 16.56, 15.76, 15.41],
          yAxisPosition: 'left',
        },
      ],
    })
  }
}
