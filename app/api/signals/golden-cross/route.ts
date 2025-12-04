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
  ma10?: number
  ma30?: number
  ma20?: number
  signal: 'MUA' | 'THEO DÕI'
  confidence: number
  recommendedPrice?: number
  cutLoss?: number
  summary: string
  lastUpdated?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '15', 10)
    const model = searchParams.get('model') || DEFAULT_GEMINI_MODEL

    // Validate model
    const selectedModel = isValidModel(model) ? model : DEFAULT_GEMINI_MODEL

    console.log('🔍 Fetching Golden Cross stocks...')
    console.log('🤖 Using Gemini model:', selectedModel)

    // Check if API keys are configured
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Fetch all stocks from Firebase /goldenCross
    const goldenCrossStocks = await getGoldenCrossStocks()

    if (goldenCrossStocks.length === 0) {
      return NextResponse.json({
        stocks: [],
        total: 0,
        message: 'No stocks found in Firebase /goldenCross'
      })
    }

    console.log(`📊 Found ${goldenCrossStocks.length} stocks from Firebase, analyzing...`)

    // Analyze each stock with Gemini
    const analyzedStocks: GoldenCrossAnalysis[] = []
    const buyRecommendations: any[] = []

    for (const stock of goldenCrossStocks) {
      try {
        console.log(`🔬 Analyzing ${stock.ticker}...`)

        // Simple prompt for Gemini
        const prompt = buildSimplePrompt(stock)

        // Call Gemini API
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 512,
              },
            }),
          }
        )

        if (!geminiResponse.ok) {
          console.warn(`⚠️ Gemini API error for ${stock.ticker}`)
          continue
        }

        const geminiData = await geminiResponse.json()
        const analysis = parseSimpleResponse(geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '')

        if (!analysis) {
          console.warn(`⚠️ Failed to parse analysis for ${stock.ticker}`)
          continue
        }

        // Calculate prices
        const currentPrice = stock.price || stock.avgNmValue || 0
        const ma20 = (stock.ma10 && stock.ma30) ? ((stock.ma10 + stock.ma30) / 2) : currentPrice // Estimate MA20 as average of MA10 and MA30
        const cutLoss = currentPrice * 0.96 // -4%

        const analyzedStock: GoldenCrossAnalysis = {
          ticker: stock.ticker,
          name: stock.name,
          price: currentPrice,
          ma10: stock.ma10,
          ma30: stock.ma30,
          ma20: ma20,
          signal: analysis.signal,
          confidence: analysis.confidence,
          recommendedPrice: ma20,
          cutLoss: cutLoss,
          summary: analysis.summary,
          lastUpdated: new Date().toISOString(),
        }

        analyzedStocks.push(analyzedStock)

        // Save MUA recommendations to Firebase
        if (analysis.signal === 'MUA') {
          try {
            const recommendationId = await saveBuyRecommendation({
              symbol: stock.ticker,
              recommendedPrice: ma20,
              currentPrice: currentPrice,
              targetPrice: ma20 * 1.1, // +10% target
              stopLoss: cutLoss,
              confidence: analysis.confidence,
              aiSignal: `Golden Cross: ${analysis.signal}`,
              technicalAnalysis: [
                `MA10: ${stock.ma10?.toFixed(2)}, MA30: ${stock.ma30?.toFixed(2)}`,
                `Giá mua đề xuất: ${ma20.toFixed(0)} (MA20)`,
                `Cut loss: ${cutLoss.toFixed(0)} (-4%)`,
              ],
              fundamentalAnalysis: [],
              risks: ['Thị trường biến động'],
              opportunities: [analysis.summary]
            })

            buyRecommendations.push({
              ticker: stock.ticker,
              recommendationId,
              signal: 'MUA',
              confidence: analysis.confidence
            })

            console.log(`✅ Saved BUY recommendation for ${stock.ticker} (ID: ${recommendationId})`)
          } catch (error) {
            console.error(`Error saving recommendation for ${stock.ticker}:`, error)
          }
        }

        // Limit results
        if (analyzedStocks.length >= limit) {
          break
        }
      } catch (error) {
        console.error(`Error analyzing ${stock.ticker}:`, error)
        continue
      }
    }

    // Sort by confidence
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
 * Build simple prompt for Gemini
 */
function buildSimplePrompt(stock: any): string {
  const currentPrice = stock.price || stock.avgNmValue || 0
  return `Bạn là chuyên gia phân tích chứng khoán. Phân tích cổ phiếu ${stock.ticker}:

Dữ liệu:
- Giá hiện tại: ${currentPrice.toLocaleString('vi-VN')} VNĐ
- MA10: ${stock.ma10?.toFixed(2)}
- MA30: ${stock.ma30?.toFixed(2)}
${stock.note ? `- Ghi chú: ${stock.note}` : ''}

Yêu cầu:
1. Đánh giá cổ phiếu này là MUA hay THEO DÕI
2. Độ tin cậy (0-100)
3. Tóm tắt ngắn gọn (1-2 câu)

Trả về ĐÚNG format JSON (không markdown):
{
  "signal": "MUA hoặc THEO DÕI",
  "confidence": <số 0-100>,
  "summary": "<tóm tắt ngắn>"
}

Chỉ trả về JSON, không thêm text khác.`
}

/**
 * Parse simple Gemini response
 */
function parseSimpleResponse(text: string): { signal: 'MUA' | 'THEO DÕI', confidence: number, summary: string } | null {
  try {
    // Remove markdown code blocks if present
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Find JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return null
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate
    if (!parsed.signal || !parsed.confidence || !parsed.summary) {
      return null
    }

    // Normalize signal
    const signal = parsed.signal.includes('MUA') ? 'MUA' : 'THEO DÕI'
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 60))

    return {
      signal,
      confidence,
      summary: parsed.summary
    }
  } catch (error) {
    console.error('Failed to parse Gemini response:', error)
    return null
  }
}
