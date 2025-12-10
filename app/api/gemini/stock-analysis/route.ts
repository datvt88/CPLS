import { NextRequest, NextResponse } from 'next/server'
import { isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/geminiModels'

export async function POST(request: NextRequest) {
  try {
    const { symbol, technicalData, fundamentalData, recommendations, news, model } = await request.json()

    // Validate input
    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { error: 'Invalid symbol' },
        { status: 400 }
      )
    }

    // Validate and set model
    const selectedModel = model && isValidModel(model) ? model : DEFAULT_GEMINI_MODEL
    console.log('🤖 Using Gemini model for stock analysis:', selectedModel, 'Symbol:', symbol)

    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Build comprehensive prompt with technical, fundamental data, analyst recommendations and news
    const prompt = buildStockAnalysisPrompt(symbol, technicalData, fundamentalData, recommendations, news)

    console.log('📊 Analyzing stock with Gemini:', symbol)

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
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
            temperature: 0.3,  // Low temperature for consistent output
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    )

    console.log('📡 Gemini API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)

      // Provide more specific error messages
      let errorMessage = 'Failed to generate analysis from Gemini API'
      if (response.status === 400) {
        errorMessage = 'Invalid request to Gemini API'
      } else if (response.status === 403) {
        errorMessage = 'API key is invalid or has been disabled'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.'
      } else if (response.status >= 500) {
        errorMessage = 'Gemini API server error. Please try again later.'
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('📥 Full Gemini API response:', JSON.stringify(data).substring(0, 500))

    // Check for API errors in response
    if (data.error) {
      console.error('❌ Gemini API returned error:', data.error)
      return NextResponse.json(
        { error: data.error.message || 'Gemini API error' },
        { status: 500 }
      )
    }

    // Try to get text content from response
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Also try to get direct JSON if responseMimeType was used
    const directContent = data.candidates?.[0]?.content?.parts?.[0]

    console.log('📝 Generated text length:', generatedText.length)
    console.log('📝 Direct content type:', typeof directContent)
    console.log('📝 Direct content preview:', JSON.stringify(directContent)?.substring(0, 300))

    let result: any

    // If we got text, parse it
    if (generatedText && generatedText.length > 10) {
      console.log('📝 Raw response preview:', generatedText.substring(0, 300))
      result = parseGeminiStockAnalysis(generatedText, technicalData?.currentPrice)
    }
    // If direct content is an object with expected fields, use it directly
    else if (directContent && typeof directContent === 'object' && (directContent.shortTerm || directContent.longTerm)) {
      console.log('📊 Using direct JSON response from Gemini')
      result = normalizeResponse(directContent, technicalData?.currentPrice)
    }
    // Try parsing the entire response as potential JSON
    else if (data.candidates?.[0]?.content) {
      console.log('🔄 Trying to parse entire content as JSON...')
      try {
        const contentStr = JSON.stringify(data.candidates[0].content)
        result = parseGeminiStockAnalysis(contentStr, technicalData?.currentPrice)
      } catch (e) {
        console.error('❌ Failed to parse content:', e)
        result = createDefaultResponse(technicalData?.currentPrice)
      }
    }
    else {
      console.error('❌ No valid content from Gemini for', symbol)
      console.error('📝 Full response data:', JSON.stringify(data))
      result = createDefaultResponse(technicalData?.currentPrice)
    }

    console.log('✅ Gemini analysis completed for', symbol, {
      shortTerm: result.shortTerm?.signal,
      longTerm: result.longTerm?.signal,
      buyPrice: result.buyPrice,
      targetPrice: result.targetPrice,
      stopLoss: result.stopLoss
    })

    return NextResponse.json({
      ...result,
      rawText: generatedText,
      symbol: symbol
    })
  } catch (error) {
    console.error('Stock analysis API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// News item interface
interface NewsItem {
  title: string
  summary: string
  source: string
  date: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relevance: 'high' | 'medium' | 'low'
}

/**
 * Build comprehensive analysis prompt combining technical, fundamental data, analyst recommendations and news
 * Short-term: 70% Technical + 30% Fundamental
 * Long-term: 70% Fundamental + 30% Technical
 */
function buildStockAnalysisPrompt(
  symbol: string,
  technicalData?: any,
  fundamentalData?: any,
  recommendations?: any[],
  news?: NewsItem[]
): string {
  // Start with clear JSON instruction
  let prompt = `Bạn là chuyên gia phân tích chứng khoán Việt Nam. Phân tích cổ phiếu ${symbol} và trả về JSON.\n\n`

  // Technical Analysis Section
  if (technicalData) {
    prompt += `DỮ LIỆU KỸ THUẬT:\n`
    prompt += `- Giá hiện tại: ${technicalData.currentPrice?.toFixed(2)} (x1000 VNĐ)\n`

    if (technicalData.ma10 && technicalData.ma30) {
      const maDiff = ((technicalData.ma10 - technicalData.ma30) / technicalData.ma30 * 100).toFixed(2)
      const maSignal = technicalData.ma10 > technicalData.ma30 ? 'TĂNG' : 'GIẢM'
      prompt += `- MA10: ${technicalData.ma10.toFixed(2)} | MA30: ${technicalData.ma30.toFixed(2)} | Chênh lệch: ${maDiff}% | Xu hướng: ${maSignal}\n`
    }

    if (technicalData.bollinger) {
      const bandPosition = ((technicalData.currentPrice - technicalData.bollinger.lower) /
                           (technicalData.bollinger.upper - technicalData.bollinger.lower) * 100).toFixed(1)
      prompt += `- Bollinger: Upper=${technicalData.bollinger.upper.toFixed(2)}, Middle=${technicalData.bollinger.middle.toFixed(2)}, Lower=${technicalData.bollinger.lower.toFixed(2)}\n`
      prompt += `- Vị trí trong Bollinger: ${bandPosition}%\n`
    }

    if (technicalData.momentum) {
      prompt += `- Momentum 5 ngày: ${technicalData.momentum.day5?.toFixed(2)}% | 10 ngày: ${technicalData.momentum.day10?.toFixed(2)}%\n`
    }

    if (technicalData.volume) {
      prompt += `- Khối lượng: ${technicalData.volume.current?.toLocaleString()} | TB 10 ngày: ${technicalData.volume.avg10?.toLocaleString()} | Tỷ lệ: ${technicalData.volume.ratio?.toFixed(0)}%\n`
    }

    if (technicalData.week52) {
      const position = ((technicalData.currentPrice - technicalData.week52.low) /
                       (technicalData.week52.high - technicalData.week52.low) * 100).toFixed(0)
      prompt += `- 52 tuần: ${technicalData.week52.low?.toFixed(2)} - ${technicalData.week52.high?.toFixed(2)} | Vị trí: ${position}%\n`
    }

    if (technicalData.buyPrice) {
      prompt += `- Hỗ trợ kỹ thuật (S2): ${technicalData.buyPrice.toFixed(2)}\n`
    }

    prompt += `\n`
  }

  // Fundamental Analysis Section
  if (fundamentalData) {
    prompt += `DỮ LIỆU CƠ BẢN:\n`

    if (fundamentalData.pe !== undefined) {
      prompt += `- P/E: ${fundamentalData.pe.toFixed(2)}\n`
    }

    if (fundamentalData.pb !== undefined) {
      prompt += `- P/B: ${fundamentalData.pb.toFixed(2)}\n`
    }

    if (fundamentalData.roe !== undefined) {
      prompt += `- ROE: ${(fundamentalData.roe * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.roa !== undefined) {
      prompt += `- ROA: ${(fundamentalData.roa * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.dividendYield !== undefined) {
      prompt += `- Cổ tức: ${(fundamentalData.dividendYield * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.marketCap !== undefined) {
      prompt += `- Vốn hóa: ${(fundamentalData.marketCap / 1000000000000).toFixed(2)} nghìn tỷ\n`
    }

    if (fundamentalData.eps !== undefined) {
      prompt += `- EPS: ${fundamentalData.eps.toFixed(2)}\n`
    }

    // Add detailed profitability data if available
    if (fundamentalData.profitability && fundamentalData.profitability.metrics && fundamentalData.profitability.metrics.length > 0) {
      prompt += `\nHIỆU QUẢ HOẠT ĐỘNG (5 QUÝ):\n`

      const { quarters, metrics } = fundamentalData.profitability
      metrics.forEach((metric: any) => {
        if (metric.label && metric.y && metric.y.length > 0) {
          prompt += `- ${metric.label}: `
          const reversedQuarters = [...quarters].reverse()
          const reversedValues = [...metric.y].reverse()
          reversedQuarters.forEach((q: string, i: number) => {
            prompt += `${q}: ${reversedValues[i].toFixed(2)}%${i < reversedQuarters.length - 1 ? ', ' : ''}`
          })

          const latest = metric.y[metric.y.length - 1]
          const oldest = metric.y[0]
          const trend = latest - oldest
          prompt += trend > 0 ? ` (tăng ${trend.toFixed(2)}%)\n` : trend < 0 ? ` (giảm ${Math.abs(trend).toFixed(2)}%)\n` : ` (ổn định)\n`
        }
      })
    }

    prompt += `\n`
  }

  // Analyst Recommendations Section
  if (recommendations && recommendations.length > 0) {
    prompt += `KHUYẾN NGHỊ CTCK:\n`

    const buyRecs = recommendations.filter(r => r.type?.toUpperCase() === 'BUY' || r.type?.toUpperCase() === 'MUA')
    const holdRecs = recommendations.filter(r => r.type?.toUpperCase() === 'HOLD' || r.type?.toUpperCase() === 'GIỮ')
    const sellRecs = recommendations.filter(r => r.type?.toUpperCase() === 'SELL' || r.type?.toUpperCase() === 'BÁN')

    const totalRecs = recommendations.length
    prompt += `- Tổng: ${totalRecs} (MUA: ${buyRecs.length}, GIỮ: ${holdRecs.length}, BÁN: ${sellRecs.length})\n`

    const recsWithTarget = recommendations.filter(r => r.targetPrice && !isNaN(r.targetPrice))
    if (recsWithTarget.length > 0) {
      const avgTarget = recsWithTarget.reduce((sum, r) => sum + r.targetPrice, 0) / recsWithTarget.length
      prompt += `- Giá mục tiêu TB: ${avgTarget.toFixed(2)}\n`
    }

    prompt += `\n`
  }

  // News Section
  if (news && news.length > 0) {
    prompt += `TIN TỨC GẦN ĐÂY:\n`

    news.forEach((item, idx) => {
      const sentimentLabel = item.sentiment === 'positive' ? 'Tích cực' :
                            item.sentiment === 'negative' ? 'Tiêu cực' : 'Trung lập'
      prompt += `${idx + 1}. [${sentimentLabel}] ${item.title} - ${item.summary}\n`
    })

    const positive = news.filter(n => n.sentiment === 'positive').length
    const negative = news.filter(n => n.sentiment === 'negative').length
    const neutral = news.filter(n => n.sentiment === 'neutral').length

    prompt += `Sentiment: Tích cực (${positive}), Tiêu cực (${negative}), Trung lập (${neutral})\n\n`
  }

  // Analysis Instructions
  prompt += `YÊU CẦU:
1. Ngắn hạn (1-4 tuần): 70% Kỹ thuật + 30% Cơ bản
2. Dài hạn (3-12 tháng): 70% Cơ bản + 30% Kỹ thuật
3. Signal: MUA, BÁN, hoặc THEO DÕI
4. Nếu MUA: cung cấp buyPrice, targetPrice, stopLoss
5. Đưa ra ĐÚNG 3 rủi ro và 3 cơ hội cụ thể cho ${symbol}
6. Phân tích tin tức nếu có

TRẢ VỀ JSON THEO ĐÚNG CẤU TRÚC SAU:
{
  "shortTerm": {
    "signal": "MUA hoặc BÁN hoặc THEO DÕI",
    "confidence": 75,
    "summary": "Phân tích ngắn hạn cụ thể"
  },
  "longTerm": {
    "signal": "MUA hoặc BÁN hoặc THEO DÕI",
    "confidence": 60,
    "summary": "Phân tích dài hạn cụ thể"
  },
  "buyPrice": 85.5,
  "targetPrice": 95,
  "stopLoss": 80,
  "risks": ["Rủi ro 1", "Rủi ro 2", "Rủi ro 3"],
  "opportunities": ["Cơ hội 1", "Cơ hội 2", "Cơ hội 3"],
  "newsAnalysis": {
    "sentiment": "positive hoặc negative hoặc neutral",
    "summary": "Tóm tắt tin tức",
    "impactOnPrice": "Tác động đến giá"
  }
}

CHÚ Ý: Nếu không MUA thì buyPrice, targetPrice, stopLoss = null. CHỈ trả về JSON, không có text khác.`

  return prompt
}

/**
 * Parse and validate Gemini response
 */
function parseGeminiStockAnalysis(text: string, currentPrice?: number): any {
  console.log('🔍 Parsing Gemini response...')
  console.log('📝 Raw text length:', text.length)
  console.log('📝 First 500 chars:', text.substring(0, 500))

  // If text is empty or too short, return default
  if (!text || text.length < 50) {
    console.error('❌ Response text is too short or empty')
    return createDefaultResponse(currentPrice)
  }

  // Clean markdown code blocks - more aggressive cleaning
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```javascript\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*[\r\n]+/gm, '')
    .trim()

  console.log('📝 Cleaned text length:', cleaned.length)

  // Method 1: Find JSON object by brace matching
  const startIdx = cleaned.indexOf('{')
  if (startIdx === -1) {
    console.error('❌ No JSON found in response')
    console.error('📝 Cleaned text:', cleaned.substring(0, 500))
    return createDefaultResponse(currentPrice)
  }

  // Find matching closing brace
  let braceCount = 0
  let endIdx = -1
  let inString = false
  let escapeNext = false

  for (let i = startIdx; i < cleaned.length; i++) {
    const char = cleaned[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (char === '"' && !escapeNext) {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') braceCount++
      if (char === '}') braceCount--
      if (braceCount === 0) {
        endIdx = i
        break
      }
    }
  }

  if (endIdx === -1) {
    console.error('❌ No closing brace found')
    console.error('📝 JSON string from start:', cleaned.substring(startIdx, startIdx + 500))
    return createDefaultResponse(currentPrice)
  }

  const jsonStr = cleaned.substring(startIdx, endIdx + 1)
  console.log('📝 Extracted JSON length:', jsonStr.length)
  console.log('📝 JSON preview:', jsonStr.substring(0, 400))

  // Try multiple parsing strategies
  const strategies = [
    // Strategy 1: Direct parse
    () => JSON.parse(jsonStr),

    // Strategy 2: Clean and parse
    () => {
      const fixedJson = jsonStr
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/,(\s*[}\]])/g, '$1')

      return JSON.parse(fixedJson)
    },

    // Strategy 3: More aggressive cleaning
    () => {
      let fixedJson = jsonStr
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
        .replace(/'/g, '"')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/"null"/gi, 'null')
        .replace(/"undefined"/gi, 'null')
        .replace(/\s+/g, ' ')

      return JSON.parse(fixedJson)
    },

    // Strategy 4: Try to find JSON with shortTerm key using regex
    () => {
      const jsonMatch = text.match(/\{[^{}]*"shortTerm"\s*:\s*\{[^{}]*\}[^{}]*"longTerm"\s*:\s*\{[^{}]*\}[^]*?\}(?=\s*$|\s*[^{])/s)
      if (!jsonMatch) throw new Error('No regex match')

      const altJson = jsonMatch[0]
        .replace(/[\x00-\x1F\x7F]/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/'/g, '"')
        .replace(/,(\s*[}\]])/g, '$1')
        .replace(/\s+/g, ' ')

      return JSON.parse(altJson)
    }
  ]

  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`🔄 Trying parsing strategy ${i + 1}...`)
      const parsed = strategies[i]()

      if (parsed && (parsed.shortTerm || parsed.longTerm)) {
        console.log(`✅ Strategy ${i + 1} succeeded`)
        console.log('📊 Parsed keys:', Object.keys(parsed))
        console.log('📊 shortTerm:', JSON.stringify(parsed.shortTerm)?.substring(0, 100))
        console.log('📊 longTerm:', JSON.stringify(parsed.longTerm)?.substring(0, 100))
        return normalizeResponse(parsed, currentPrice)
      }
    } catch (error) {
      console.log(`⚠️ Strategy ${i + 1} failed:`, error instanceof Error ? error.message : error)
    }
  }

  console.error('❌ All parsing strategies failed')
  console.error('📝 Final JSON string:', jsonStr.substring(0, 800))
  return createDefaultResponse(currentPrice)
}

/**
 * Normalize parsed response
 */
function normalizeResponse(parsed: any, currentPrice?: number): any {
  const result: any = {}

  // Normalize shortTerm
  if (parsed.shortTerm) {
    result.shortTerm = {
      signal: normalizeSignal(parsed.shortTerm.signal),
      confidence: normalizeConfidence(parsed.shortTerm.confidence),
      summary: String(parsed.shortTerm.summary || '').trim() || 'Phân tích kỹ thuật cho thấy cần theo dõi thêm các chỉ báo.'
    }
  } else {
    result.shortTerm = {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Không đủ dữ liệu phân tích ngắn hạn.'
    }
  }

  // Normalize longTerm
  if (parsed.longTerm) {
    result.longTerm = {
      signal: normalizeSignal(parsed.longTerm.signal),
      confidence: normalizeConfidence(parsed.longTerm.confidence),
      summary: String(parsed.longTerm.summary || '').trim() || 'Phân tích cơ bản cho thấy cần theo dõi các chỉ số tài chính.'
    }
  } else {
    result.longTerm = {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Không đủ dữ liệu phân tích dài hạn.'
    }
  }

  // Check if any signal is MUA
  const hasBuySignal = result.shortTerm.signal === 'MUA' || result.longTerm.signal === 'MUA'

  // Normalize prices (only if buy signal)
  if (hasBuySignal) {
    result.buyPrice = formatPrice(parsed.buyPrice)
    result.targetPrice = formatPrice(parsed.targetPrice)
    result.stopLoss = formatPrice(parsed.stopLoss)
  } else {
    result.buyPrice = null
    result.targetPrice = null
    result.stopLoss = null
  }

  // Normalize risks and opportunities (exactly 3 each)
  result.risks = normalizeArray(parsed.risks, 3, [
    'Biến động thị trường có thể ảnh hưởng đến giá',
    'Rủi ro thanh khoản khi giao dịch',
    'Cần theo dõi thêm các chỉ số tài chính'
  ])

  result.opportunities = normalizeArray(parsed.opportunities, 3, [
    'Tiềm năng tăng trưởng từ ngành',
    'Định giá có thể hấp dẫn so với các chỉ số cơ bản',
    'Cơ hội từ xu hướng kỹ thuật'
  ])

  // Normalize newsAnalysis if present
  if (parsed.newsAnalysis) {
    result.newsAnalysis = {
      sentiment: normalizeNewsSentiment(parsed.newsAnalysis.sentiment),
      summary: String(parsed.newsAnalysis.summary || '').trim() || 'Chưa có đủ thông tin tin tức để phân tích.',
      impactOnPrice: String(parsed.newsAnalysis.impactOnPrice || '').trim() || 'Cần theo dõi thêm diễn biến tin tức.'
    }
  }

  return result
}

/**
 * Normalize news sentiment value
 */
function normalizeNewsSentiment(sentiment: any): 'positive' | 'negative' | 'neutral' {
  if (!sentiment) return 'neutral'
  const s = String(sentiment).toLowerCase().trim()

  if (s.includes('positive') || s.includes('tích cực')) return 'positive'
  if (s.includes('negative') || s.includes('tiêu cực')) return 'negative'
  return 'neutral'
}

/**
 * Normalize signal value
 */
function normalizeSignal(signal: any): string {
  if (!signal) return 'THEO DÕI'
  const s = String(signal).toUpperCase().trim()

  if (s.includes('MUA') || s.includes('BUY')) return 'MUA'
  if (s.includes('BÁN') || s.includes('SELL')) return 'BÁN'
  return 'THEO DÕI'
}

/**
 * Normalize confidence value
 */
function normalizeConfidence(confidence: any): number {
  const num = Number(confidence)
  if (isNaN(num)) return 50
  return Math.max(0, Math.min(100, Math.round(num)))
}

/**
 * Format price value
 */
function formatPrice(price: any): string | null {
  if (price === null || price === undefined || price === 'null') return null

  const num = Number(price)
  if (isNaN(num)) return null

  // If too small, multiply by 1000 (assuming x1000 VND format)
  const finalNum = num < 1000 ? num * 1000 : num

  return finalNum.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

/**
 * Normalize array to exactly n items
 */
function normalizeArray(arr: any, count: number, defaults: string[]): string[] {
  const result: string[] = []

  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (item && typeof item === 'string' && item.trim().length > 3) {
        result.push(item.trim())
        if (result.length >= count) break
      }
    }
  }

  // Fill with defaults if needed
  let defaultIdx = 0
  while (result.length < count && defaultIdx < defaults.length) {
    result.push(defaults[defaultIdx])
    defaultIdx++
  }

  return result.slice(0, count)
}

/**
 * Create default response
 */
function createDefaultResponse(currentPrice?: number): any {
  return {
    shortTerm: {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Cần theo dõi thêm các chỉ báo kỹ thuật trước khi đưa ra quyết định.'
    },
    longTerm: {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Cần phân tích thêm các chỉ số cơ bản để đánh giá dài hạn.'
    },
    buyPrice: null,
    targetPrice: null,
    stopLoss: null,
    risks: [
      'Biến động thị trường có thể ảnh hưởng đến giá',
      'Rủi ro thanh khoản khi giao dịch',
      'Cần theo dõi thêm các chỉ số tài chính'
    ],
    opportunities: [
      'Tiềm năng tăng trưởng từ ngành',
      'Định giá có thể hấp dẫn so với các chỉ số cơ bản',
      'Cơ hội từ xu hướng kỹ thuật'
    ]
  }
}
