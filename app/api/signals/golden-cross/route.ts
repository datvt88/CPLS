import { NextRequest, NextResponse } from 'next/server'
import { getGoldenCrossStocks } from '@/services/goldenCross.service'
import { saveBuyRecommendation } from '@/services/recommendations.service'
import { isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/geminiModels'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface GoldenCrossAnalysis {
  ticker: string
  name?: string
  price?: number
  crossDate?: string
  ma10?: number
  ma30?: number
  signal: 'MUA' | 'THEO DÕI' | 'NẮM GIỮ'
  confidence: number
  shortTermSignal: string
  longTermSignal: string
  targetPrice?: string
  stopLoss?: string
  summary: string
  risks: string[]
  opportunities: string[]
  technicalScore: number
  fundamentalScore: number
  lastUpdated?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '15', 10)
    const model = searchParams.get('model') || DEFAULT_GEMINI_MODEL

    // Validate model
    const selectedModel = isValidModel(model) ? model : DEFAULT_GEMINI_MODEL

    console.log('🔍 Fetching Golden Cross stocks with analysis...')
    console.log('🤖 Using Gemini model:', selectedModel)

    // Check if API keys are configured
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Fetch golden cross stocks from Firebase (ma10 > ma30)
    const goldenCrossStocks = await getGoldenCrossStocks(limit * 2) // Fetch more to filter later

    if (goldenCrossStocks.length === 0) {
      return NextResponse.json({
        stocks: [],
        total: 0,
        message: 'No Golden Cross stocks found in database'
      })
    }

    console.log(`📊 Found ${goldenCrossStocks.length} Golden Cross stocks, analyzing with Stock Analysis API...`)

    // Analyze each stock using Stock Analysis API
    const analyzedStocks: GoldenCrossAnalysis[] = []
    const buyRecommendations: any[] = []

    for (const stock of goldenCrossStocks) {
      try {
        console.log(`🔬 Analyzing ${stock.ticker} using Stock Analysis API...`)

        // Fetch stock data from VNDirect (prices, financials, recommendations)
        const [priceData, financialRatios, recommendations] = await Promise.all([
          fetchStockPrice(stock.ticker),
          fetchFinancialRatios(stock.ticker),
          fetchRecommendations(stock.ticker)
        ])

        if (!priceData) {
          console.warn(`⚠️ No price data for ${stock.ticker}, skipping...`)
          continue
        }

        // Prepare data for Gemini analysis
        const technicalData = {
          currentPrice: priceData.close || stock.price || 0,
          ma10: stock.ma200, // ma200 mapped from ma10
          ma30: stock.ma50,  // ma50 mapped from ma30
          volume: {
            current: priceData.volume || stock.volume || 0,
          },
          goldenCross: {
            crossDate: stock.crossDate,
            ma10: stock.ma200,
            ma30: stock.ma50,
          }
        }

        // Call Stock Analysis API (same as used in Cổ Phiếu)
        const analysis = await callStockAnalysisAPI(
          stock.ticker,
          technicalData,
          financialRatios,
          recommendations,
          selectedModel
        )

        if (!analysis) {
          console.warn(`⚠️ Failed to analyze ${stock.ticker}, skipping...`)
          continue
        }

        // Calculate scores
        const technicalScore = calculateTechnicalScore(stock, analysis)
        const fundamentalScore = analysis.longTerm.confidence

        // Determine signal
        const signal = determineSignal(analysis, technicalScore, fundamentalScore)

        const analyzedStock: GoldenCrossAnalysis = {
          ticker: stock.ticker,
          name: stock.name,
          price: priceData.close || stock.price,
          crossDate: stock.crossDate,
          ma10: stock.ma200, // ma10 from Firebase
          ma30: stock.ma50,  // ma30 from Firebase
          signal,
          confidence: Math.round((analysis.shortTerm.confidence + analysis.longTerm.confidence) / 2),
          shortTermSignal: analysis.shortTerm.signal,
          longTermSignal: analysis.longTerm.signal,
          targetPrice: analysis.targetPrice,
          stopLoss: analysis.stopLoss,
          summary: analysis.shortTerm.summary || 'Cổ phiếu có tín hiệu Golden Cross tích cực',
          risks: analysis.risks || [],
          opportunities: analysis.opportunities || [],
          technicalScore,
          fundamentalScore,
          lastUpdated: new Date().toISOString(),
        }

        analyzedStocks.push(analyzedStock)

        // Save MUA recommendations to Firebase
        if (signal === 'MUA' && analysis.targetPrice) {
          try {
            const recommendationId = await saveBuyRecommendation({
              symbol: stock.ticker,
              recommendedPrice: priceData.close || stock.price || 0,
              currentPrice: priceData.close || stock.price || 0,
              targetPrice: parseTargetPrice(analysis.targetPrice),
              stopLoss: parseStopLoss(analysis.stopLoss),
              confidence: Math.round((analysis.shortTerm.confidence + analysis.longTerm.confidence) / 2),
              aiSignal: `${analysis.shortTerm.signal} / ${analysis.longTerm.signal}`,
              technicalAnalysis: [
                `Golden Cross: MA10(${stock.ma200?.toFixed(2)}) > MA30(${stock.ma50?.toFixed(2)})`,
                `Technical Score: ${technicalScore}/100`,
                ...analysis.opportunities.slice(0, 2)
              ],
              fundamentalAnalysis: financialRatios ? [
                `P/E: ${financialRatios.pe?.toFixed(2) || 'N/A'}`,
                `P/B: ${financialRatios.pb?.toFixed(2) || 'N/A'}`,
                `ROE: ${((financialRatios.roe || 0) * 100).toFixed(2)}%`,
              ] : [],
              risks: analysis.risks,
              opportunities: analysis.opportunities
            })

            buyRecommendations.push({
              ticker: stock.ticker,
              recommendationId,
              signal: 'MUA',
              confidence: analyzedStock.confidence
            })

            console.log(`✅ Saved BUY recommendation for ${stock.ticker} (ID: ${recommendationId})`)
          } catch (error) {
            console.error(`Error saving recommendation for ${stock.ticker}:`, error)
          }
        }

        // Limit the number of analyzed stocks
        if (analyzedStocks.length >= limit) {
          break
        }
      } catch (error) {
        console.error(`Error analyzing ${stock.ticker}:`, error)
        continue
      }
    }

    // Sort by confidence score (highest first)
    analyzedStocks.sort((a, b) => b.confidence - a.confidence)

    console.log(`✅ Successfully analyzed ${analyzedStocks.length} stocks`)
    console.log(`💾 Saved ${buyRecommendations.length} BUY recommendations to Firebase`)

    return NextResponse.json({
      stocks: analyzedStocks,
      total: analyzedStocks.length,
      buyRecommendations: buyRecommendations.length,
      model: selectedModel,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Golden Cross API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        stocks: [],
        total: 0,
      },
      { status: 500 }
    )
  }
}

/**
 * Fetch stock price from VNDirect
 */
async function fetchStockPrice(ticker: string) {
  try {
    const response = await fetch(`https://finfo-api.vndirect.com.vn/v4/stock_prices?sort=date&q=code:${ticker}&size=1&page=1`)
    const data = await response.json()
    return data.data?.[0] || null
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error)
    return null
  }
}

/**
 * Fetch financial ratios from VNDirect
 */
async function fetchFinancialRatios(ticker: string) {
  try {
    const response = await fetch(`https://finfo-api.vndirect.com.vn/v4/ratios?q=code:${ticker}&size=1`)
    const data = await response.json()
    return data.data?.[0] || null
  } catch (error) {
    console.error(`Error fetching ratios for ${ticker}:`, error)
    return null
  }
}

/**
 * Fetch analyst recommendations
 */
async function fetchRecommendations(ticker: string) {
  try {
    const response = await fetch(`https://finfo-api.vndirect.com.vn/v4/stock_recommendation?q=code:${ticker}&size=20`)
    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error(`Error fetching recommendations for ${ticker}:`, error)
    return []
  }
}

/**
 * Call Stock Analysis API (same as Cổ Phiếu uses)
 */
async function callStockAnalysisAPI(
  ticker: string,
  technicalData: any,
  fundamentalData: any,
  recommendations: any[],
  model: string
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/gemini/stock-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol: ticker,
        technicalData,
        fundamentalData,
        recommendations,
        model
      })
    })

    if (!response.ok) {
      console.error(`Stock Analysis API error for ${ticker}:`, response.status)
      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Error calling Stock Analysis API for ${ticker}:`, error)
    return null
  }
}

/**
 * Calculate technical score based on Golden Cross and indicators
 */
function calculateTechnicalScore(stock: any, analysis: any): number {
  let score = 60 // Base score for having Golden Cross

  // MA10 above MA30
  if (stock.ma200 && stock.ma50) {
    const maGap = ((stock.ma200 - stock.ma50) / stock.ma50) * 100
    if (maGap > 5) score += 15
    else if (maGap > 2) score += 10
    else if (maGap > 0) score += 5
  }

  // Price above MA30
  if (stock.price && stock.ma50 && stock.price > stock.ma50) {
    score += 10
  }

  // Recent cross (within 30 days)
  if (stock.crossDate) {
    const daysSinceCross = Math.floor(
      (new Date().getTime() - new Date(stock.crossDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysSinceCross <= 7) score += 15
    else if (daysSinceCross <= 30) score += 10
  }

  return Math.min(100, score)
}

/**
 * Determine if stock should be marked as MUA or THEO DÕI
 */
function determineSignal(analysis: any, technicalScore: number, fundamentalScore: number): 'MUA' | 'THEO DÕI' | 'NẮM GIỮ' {
  const avgScore = (technicalScore + fundamentalScore) / 2

  // MUA criteria
  if (
    (analysis.shortTerm.signal.includes('MUA') || analysis.longTerm.signal.includes('MUA')) &&
    avgScore >= 70 &&
    analysis.targetPrice
  ) {
    return 'MUA'
  }

  // THEO DÕI criteria
  if (avgScore >= 60) {
    return 'THEO DÕI'
  }

  return 'NẮM GIỮ'
}

/**
 * Parse target price from string
 */
function parseTargetPrice(targetPrice?: string): number {
  if (!targetPrice) return 0
  const match = targetPrice.match(/[\d,]+/)
  if (!match) return 0
  return parseFloat(match[0].replace(/,/g, ''))
}

/**
 * Parse stop loss from string
 */
function parseStopLoss(stopLoss?: string): number {
  if (!stopLoss) return 0
  const match = stopLoss.match(/[\d,]+/)
  if (!match) return 0
  return parseFloat(match[0].replace(/,/g, ''))
}
