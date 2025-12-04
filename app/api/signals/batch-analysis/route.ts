import { NextRequest, NextResponse } from 'next/server'
import { fetchStockPrices, fetchFinancialRatios } from '@/services/vndirect'

/**
 * POST /api/signals/batch-analysis
 * Analyze multiple stocks and return only those with good technical and fundamental analysis
 */
export async function POST(request: NextRequest) {
  try {
    const { symbols } = await request.json()

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { error: 'Invalid symbols array' },
        { status: 400 }
      )
    }

    console.log(`🔍 Analyzing ${symbols.length} stocks for signals...`)

    // Analyze each stock
    const analysisPromises = symbols.map(async (symbol) => {
      try {
        // Fetch data with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout per stock

        const [pricesResponse, ratiosResponse, profitabilityResponse] = await Promise.all([
          fetchStockPrices(symbol, 270).finally(() => clearTimeout(timeoutId)),
          fetchFinancialRatios(symbol).catch(() => ({ data: [] })),
          fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`)
            .then(res => res.json())
            .catch(() => null)
        ])

        if (!pricesResponse.data || pricesResponse.data.length === 0) {
          return null
        }

        // Sort price data
        const sortedData = [...pricesResponse.data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        // Calculate technical indicators
        const closePrices = sortedData.map(d => d.adClose)
        const currentPrice = closePrices[closePrices.length - 1]

        if (!currentPrice || isNaN(currentPrice)) {
          return null
        }

        const ma10 = calculateSMA(closePrices, 10)
        const ma30 = calculateSMA(closePrices, 30)
        const currentMA10 = ma10[ma10.length - 1]
        const currentMA30 = ma30[ma30.length - 1]

        // Technical filter: MA10 > MA30 (golden cross or uptrend)
        if (isNaN(currentMA10) || isNaN(currentMA30) || currentMA10 <= currentMA30) {
          return null
        }

        // Process fundamental data
        const ratiosMap: Record<string, any> = {}
        ratiosResponse.data.forEach((ratio: any) => {
          ratiosMap[ratio.ratioCode] = ratio
        })

        const pe = ratiosMap['PRICE_TO_EARNINGS']?.value
        const pb = ratiosMap['PRICE_TO_BOOK']?.value
        const roe = ratiosMap['ROAE_TR_AVG5Q']?.value

        // Fundamental filters
        let fundamentalScore = 0
        let fundamentalReasons = []

        // P/E filter (positive and reasonable)
        if (pe !== undefined && pe !== null && pe > 0 && pe < 25) {
          fundamentalScore += 1
          fundamentalReasons.push(`P/E: ${pe.toFixed(2)}`)
        } else if (pe > 25) {
          return null // Too expensive
        } else if (pe < 0) {
          return null // Company is losing money
        }

        // P/B filter (reasonable valuation)
        if (pb !== undefined && pb !== null && pb > 0 && pb < 3) {
          fundamentalScore += 1
          fundamentalReasons.push(`P/B: ${pb.toFixed(2)}`)
        }

        // ROE filter (good profitability)
        if (roe !== undefined && roe !== null) {
          const roePercent = roe * 100
          if (roePercent > 10) {
            fundamentalScore += 1
            fundamentalReasons.push(`ROE: ${roePercent.toFixed(2)}%`)
          } else {
            return null // Poor profitability
          }
        }

        // Check ROE trend from profitability data
        if (profitabilityResponse && profitabilityResponse.data && profitabilityResponse.data.length > 0) {
          const roeData = profitabilityResponse.data.find((m: any) => m.label === 'ROE')
          if (roeData && roeData.y && roeData.y.length >= 2) {
            const latestROE = roeData.y[roeData.y.length - 1]
            const previousROE = roeData.y[roeData.y.length - 2]

            // Prefer improving ROE
            if (latestROE > previousROE) {
              fundamentalScore += 1
              fundamentalReasons.push(`ROE cải thiện: ${latestROE.toFixed(2)}%`)
            }
          }
        }

        // Require at least 2 fundamental criteria passed
        if (fundamentalScore < 2) {
          return null
        }

        return {
          symbol,
          currentPrice,
          ma10: currentMA10,
          ma30: currentMA30,
          pe,
          pb,
          roe: roe ? roe * 100 : null,
          fundamentalScore,
          fundamentalReasons
        }
      } catch (error) {
        console.error(`Error analyzing ${symbol}:`, error)
        return null
      }
    })

    // Wait for all analysis to complete
    const results = await Promise.all(analysisPromises)

    // Filter out null results
    const goodStocks = results.filter(r => r !== null)

    // Sort by fundamental score (descending)
    goodStocks.sort((a, b) => (b?.fundamentalScore || 0) - (a?.fundamentalScore || 0))

    console.log(`✅ Found ${goodStocks.length} good stocks out of ${symbols.length}`)

    return NextResponse.json({
      success: true,
      total: symbols.length,
      filtered: goodStocks.length,
      data: goodStocks
    })
  } catch (error) {
    console.error('Batch analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = []

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN)
      continue
    }

    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }

  return sma
}
