import { NextRequest, NextResponse } from 'next/server'
import { getGoldenCrossStocks } from '@/services/goldenCross.service'
import { isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/geminiModels'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface GoldenCrossAnalysis {
  ticker: string
  name?: string
  price?: number
  crossDate?: string
  ma50?: number
  ma200?: number
  signal: 'MUA' | 'THEO DÕI'
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
    const limit = parseInt(searchParams.get('limit') || '10', 10)
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

    // Fetch golden cross stocks from Firebase
    const goldenCrossStocks = await getGoldenCrossStocks(limit * 2) // Fetch more to filter later

    if (goldenCrossStocks.length === 0) {
      return NextResponse.json({
        stocks: [],
        total: 0,
        message: 'No Golden Cross stocks found in database'
      })
    }

    console.log(`📊 Found ${goldenCrossStocks.length} Golden Cross stocks, analyzing...`)

    // Analyze each stock with Gemini AI
    const analyzedStocks: GoldenCrossAnalysis[] = []

    for (const stock of goldenCrossStocks) {
      try {
        console.log(`🔬 Analyzing ${stock.ticker}...`)

        // Prepare technical data for analysis
        const technicalData = {
          currentPrice: stock.price || 0,
          ma50: stock.ma50,
          ma200: stock.ma200,
          volume: {
            current: stock.volume || 0,
          },
          goldenCross: {
            crossDate: stock.crossDate,
            ma50: stock.ma50,
            ma200: stock.ma200,
          }
        }

        // Call Gemini API for analysis
        const analysis = await analyzeStockWithGemini(
          stock.ticker,
          technicalData,
          selectedModel,
          geminiKey
        )

        if (!analysis) {
          console.warn(`⚠️ Failed to analyze ${stock.ticker}, skipping...`)
          continue
        }

        // Calculate technical and fundamental scores
        const technicalScore = calculateTechnicalScore(stock, analysis)
        const fundamentalScore = analysis.longTerm.confidence

        // Determine if this is a BUY or FOLLOW signal
        const signal = determineSignal(analysis, technicalScore, fundamentalScore)

        // Only include stocks with BUY or FOLLOW signal
        if (signal === 'MUA' || signal === 'THEO DÕI') {
          analyzedStocks.push({
            ticker: stock.ticker,
            name: stock.name,
            price: stock.price,
            crossDate: stock.crossDate,
            ma50: stock.ma50,
            ma200: stock.ma200,
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
            lastUpdated: stock.lastUpdated || new Date().toISOString(),
          })
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

    return NextResponse.json({
      stocks: analyzedStocks,
      total: analyzedStocks.length,
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
 * Analyze stock with Gemini AI
 */
async function analyzeStockWithGemini(
  ticker: string,
  technicalData: any,
  model: string,
  apiKey: string
): Promise<any> {
  try {
    const prompt = buildGoldenCrossAnalysisPrompt(ticker, technicalData)

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    )

    if (!response.ok) {
      console.error(`Gemini API error for ${ticker}:`, response.status)
      return null
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!generatedText) {
      return null
    }

    return parseGeminiResponse(generatedText)
  } catch (error) {
    console.error(`Error calling Gemini for ${ticker}:`, error)
    return null
  }
}

/**
 * Build analysis prompt for Golden Cross stocks
 */
function buildGoldenCrossAnalysisPrompt(ticker: string, technicalData: any): string {
  let prompt = `Bạn là chuyên gia phân tích chứng khoán. Cổ phiếu ${ticker} VỪA CÓ TÍN HIỆU GOLDEN CROSS (MA50 vượt lên trên MA200).\n\n`

  prompt += `📊 DỮ LIỆU:\n`
  prompt += `Giá hiện tại: ${technicalData.currentPrice?.toLocaleString()} VNĐ\n`

  if (technicalData.goldenCross) {
    prompt += `Ngày Golden Cross: ${technicalData.goldenCross.crossDate || 'Gần đây'}\n`
    prompt += `MA50: ${technicalData.goldenCross.ma50?.toFixed(2)}\n`
    prompt += `MA200: ${technicalData.goldenCross.ma200?.toFixed(2)}\n`

    const ma50AboveMA200 = ((technicalData.goldenCross.ma50 - technicalData.goldenCross.ma200) / technicalData.goldenCross.ma200 * 100).toFixed(2)
    prompt += `MA50 cao hơn MA200: ${ma50AboveMA200}%\n`
  }

  if (technicalData.volume) {
    prompt += `Khối lượng: ${technicalData.volume.current?.toLocaleString()}\n`
  }

  prompt += `\n🎯 YÊU CẦU:\n`
  prompt += `1. Phân tích ý nghĩa của tín hiệu Golden Cross này\n`
  prompt += `2. Đánh giá khả năng tăng giá trong ngắn hạn (1-4 tuần) và dài hạn (3-6 tháng)\n`
  prompt += `3. Xác định mức giá mục tiêu và điểm cắt lỗ hợp lý\n`
  prompt += `4. Đưa ra khuyến nghị rõ ràng: MUA hoặc NẮM GIỮ\n`
  prompt += `5. Phân tích rủi ro và cơ hội\n\n`

  prompt += `📋 FORMAT JSON (không thêm markdown hay text khác):\n`
  prompt += `{\n`
  prompt += `  "shortTerm": {\n`
  prompt += `    "signal": "MUA hoặc NẮM GIỮ",\n`
  prompt += `    "confidence": <số từ 0-100>,\n`
  prompt += `    "summary": "<phân tích ngắn 1-2 câu>"\n`
  prompt += `  },\n`
  prompt += `  "longTerm": {\n`
  prompt += `    "signal": "MUA hoặc NẮM GIỮ",\n`
  prompt += `    "confidence": <số từ 0-100>,\n`
  prompt += `    "summary": "<phân tích dài hạn>"\n`
  prompt += `  },\n`
  prompt += `  "targetPrice": "<giá mục tiêu, VD: 45000-50000>",\n`
  prompt += `  "stopLoss": "<mức cắt lỗ, VD: 38000>",\n`
  prompt += `  "risks": ["<rủi ro 1>", "<rủi ro 2>"],\n`
  prompt += `  "opportunities": ["<cơ hội 1>", "<cơ hội 2>"]\n`
  prompt += `}\n\n`

  prompt += `LƯU Ý: Chỉ trả về JSON, không thêm text hay markdown.\n`

  return prompt
}

/**
 * Parse Gemini response
 */
function parseGeminiResponse(text: string): any {
  try {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Find JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return null
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate structure
    if (!parsed.shortTerm || !parsed.longTerm) {
      return null
    }

    // Ensure confidence is valid
    parsed.shortTerm.confidence = Math.max(0, Math.min(100, Number(parsed.shortTerm.confidence) || 60))
    parsed.longTerm.confidence = Math.max(0, Math.min(100, Number(parsed.longTerm.confidence) || 60))

    // Ensure arrays
    parsed.risks = Array.isArray(parsed.risks) ? parsed.risks : []
    parsed.opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : []

    return parsed
  } catch (error) {
    console.error('Failed to parse Gemini response:', error)
    return null
  }
}

/**
 * Calculate technical score based on Golden Cross and other indicators
 */
function calculateTechnicalScore(stock: any, analysis: any): number {
  let score = 60 // Base score for having Golden Cross

  // MA50 position above MA200
  if (stock.ma50 && stock.ma200) {
    const ma50Above = ((stock.ma50 - stock.ma200) / stock.ma200) * 100
    if (ma50Above > 5) score += 15
    else if (ma50Above > 2) score += 10
    else if (ma50Above > 0) score += 5
  }

  // Price above MA50
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
    else if (daysSinceCross <= 60) score += 5
  }

  return Math.min(100, score)
}

/**
 * Determine if stock should be marked as BUY or FOLLOW
 */
function determineSignal(analysis: any, technicalScore: number, fundamentalScore: number): 'MUA' | 'THEO DÕI' {
  const avgScore = (technicalScore + fundamentalScore) / 2

  // BUY signal criteria:
  // - Both short-term and long-term signals are BUY
  // - Average score >= 70
  // - Has target price
  const isBuySignal =
    (analysis.shortTerm.signal === 'MUA' || analysis.longTerm.signal === 'MUA') &&
    avgScore >= 70 &&
    analysis.targetPrice

  return isBuySignal ? 'MUA' : 'THEO DÕI'
}
