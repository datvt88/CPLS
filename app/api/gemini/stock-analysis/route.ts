import { NextRequest, NextResponse } from 'next/server'
import { isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/geminiModels'

export async function POST(request: NextRequest) {
  try {
    const { symbol, technicalData, fundamentalData, recommendations, model } = await request.json()

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

    // Build comprehensive prompt with technical, fundamental data and analyst recommendations
    const prompt = buildStockAnalysisPrompt(symbol, technicalData, fundamentalData, recommendations)

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
            temperature: 0.7,
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
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!generatedText) {
      console.error('No content generated from Gemini for', symbol)
      return NextResponse.json(
        { error: 'No content generated from Gemini' },
        { status: 500 }
      )
    }

    console.log('📝 Gemini raw response length:', generatedText.length)
    console.log('📝 Raw response preview:', generatedText.substring(0, 300))

    // Parse and validate the response (always returns a result with fallback)
    const result = parseGeminiStockAnalysis(generatedText, technicalData?.currentPrice)

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

/**
 * Build comprehensive analysis prompt combining technical, fundamental data and analyst recommendations
 * Short-term: 70% Technical + 30% Fundamental
 * Long-term: 70% Fundamental + 30% Technical
 */
function buildStockAnalysisPrompt(
  symbol: string,
  technicalData?: any,
  fundamentalData?: any,
  recommendations?: any
): string {
  let prompt = `Bạn là chuyên gia phân tích chứng khoán Việt Nam. Phân tích cổ phiếu ${symbol}:\n\n`

  // Technical Analysis Section with pre-calculated signals
  if (technicalData) {
    prompt += `📊 PHÂN TÍCH KỸ THUẬT:\n`
    prompt += `• Giá hiện tại: ${technicalData.currentPrice?.toFixed(2)} (x1000 VNĐ)\n`

    // MA Trend
    if (technicalData.ma10 && technicalData.ma30) {
      const maDiff = ((technicalData.ma10 - technicalData.ma30) / technicalData.ma30 * 100).toFixed(2)
      prompt += `• MA10/MA30: ${technicalData.ma10.toFixed(2)}/${technicalData.ma30.toFixed(2)} (${maDiff}%)\n`
      prompt += `• Xu hướng MA: ${technicalData.maTrend || (technicalData.ma10 > technicalData.ma30 ? 'TĂNG' : 'GIẢM')}\n`
      if (technicalData.lastCrossover) {
        prompt += `• Tín hiệu gần đây: ${technicalData.lastCrossover === 'GOLDEN_CROSS' ? '🟢 GOLDEN CROSS (MUA)' : '🔴 DEATH CROSS (BÁN)'}\n`
      }
    }

    // Bollinger signal
    if (technicalData.bollingerSignal) {
      prompt += `• Bollinger: ${technicalData.bollingerPosition}% - ${technicalData.bollingerSignal}\n`
    } else if (technicalData.bollinger) {
      const pos = ((technicalData.currentPrice - technicalData.bollinger.lower) / (technicalData.bollinger.upper - technicalData.bollinger.lower) * 100).toFixed(0)
      const sig = Number(pos) >= 80 ? 'QUÁ MUA' : Number(pos) <= 20 ? 'QUÁ BÁN' : 'TRUNG LẬP'
      prompt += `• Bollinger: ${pos}% - ${sig}\n`
    }

    // Momentum
    if (technicalData.momentum) {
      const mom5 = technicalData.momentum.day5
      const mom10 = technicalData.momentum.day10
      prompt += `• Momentum: 5D ${mom5 >= 0 ? '+' : ''}${mom5?.toFixed(2)}% | 10D ${mom10 >= 0 ? '+' : ''}${mom10?.toFixed(2)}%\n`
    }

    // Volume signal
    if (technicalData.volumeSignal) {
      prompt += `• Khối lượng: ${technicalData.volumeSignal} (${technicalData.volume?.ratio?.toFixed(0)}% so với TB)\n`
    } else if (technicalData.volume) {
      const volSig = technicalData.volume.ratio >= 150 ? 'TĂNG MẠNH' : technicalData.volume.ratio <= 70 ? 'THẤP' : 'BÌNH THƯỜNG'
      prompt += `• Khối lượng: ${volSig} (${technicalData.volume.ratio?.toFixed(0)}%)\n`
    }

    // 52-week position
    if (technicalData.week52Signal) {
      prompt += `• Vị trí 52 tuần: ${technicalData.week52?.position}% - ${technicalData.week52Signal}\n`
    } else if (technicalData.week52) {
      const pos = ((technicalData.currentPrice - technicalData.week52.low) / (technicalData.week52.high - technicalData.week52.low) * 100).toFixed(0)
      prompt += `• Vị trí 52 tuần: ${pos}%\n`
    }

    // Support level for buy
    if (technicalData.buyPrice) {
      prompt += `• Hỗ trợ (S2): ${technicalData.buyPrice.toFixed(2)}\n`
    }

    prompt += `\n`
  }

  // Fundamental Analysis Section
  if (fundamentalData) {
    prompt += `💰 CHỈ SỐ TÀI CHÍNH:\n`

    if (fundamentalData.pe !== undefined && fundamentalData.pe !== null) {
      const peSignal = fundamentalData.pe < 0 ? 'ÂM' : fundamentalData.pe < 10 ? 'RẺ' : fundamentalData.pe <= 20 ? 'HỢP LÝ' : 'CAO'
      prompt += `• P/E: ${fundamentalData.pe.toFixed(2)} (${peSignal})\n`
    }

    if (fundamentalData.pb !== undefined && fundamentalData.pb !== null) {
      const pbSignal = fundamentalData.pb < 1 ? 'DƯỚI SĐSS' : fundamentalData.pb <= 2 ? 'HỢP LÝ' : 'CAO'
      prompt += `• P/B: ${fundamentalData.pb.toFixed(2)} (${pbSignal})\n`
    }

    if (fundamentalData.roe !== undefined && fundamentalData.roe !== null) {
      const roeVal = fundamentalData.roe * 100
      const roeSignal = roeVal >= 15 ? 'TỐT' : roeVal >= 10 ? 'KHÁ' : 'THẤP'
      prompt += `• ROE: ${roeVal.toFixed(2)}% (${roeSignal})\n`
    }

    if (fundamentalData.roa !== undefined && fundamentalData.roa !== null) {
      const roaVal = fundamentalData.roa * 100
      prompt += `• ROA: ${roaVal.toFixed(2)}%\n`
    }

    if (fundamentalData.eps !== undefined && fundamentalData.eps !== null) {
      prompt += `• EPS: ${fundamentalData.eps.toFixed(0)} VNĐ\n`
    }

    if (fundamentalData.dividendYield !== undefined && fundamentalData.dividendYield !== null) {
      prompt += `• Cổ tức: ${(fundamentalData.dividendYield * 100).toFixed(2)}%\n`
    }

    // Profitability trends
    if (fundamentalData.profitability?.metrics?.length > 0) {
      prompt += `\n📈 HIỆU QUẢ HOẠT ĐỘNG:\n`
      const { quarters, metrics } = fundamentalData.profitability
      metrics.slice(0, 3).forEach((metric: any) => {
        if (metric.label && metric.y?.length > 0) {
          const latest = metric.y[metric.y.length - 1]
          const oldest = metric.y[0]
          const trend = latest - oldest
          const trendText = trend > 1 ? '📈 TĂNG' : trend < -1 ? '📉 GIẢM' : '➡️ ỔN ĐỊNH'
          prompt += `• ${metric.label}: ${latest?.toFixed(2)}% (${trendText})\n`
        }
      })
    }

    prompt += `\n`
  }

  // Analyst Recommendations with statistics
  if (recommendations?.statistics) {
    const stats = recommendations.statistics
    prompt += `📋 KHUYẾN NGHỊ TỪ CTCK:\n`
    prompt += `• Tổng: ${stats.total} đánh giá\n`
    prompt += `• MUA: ${stats.buy} (${stats.buyPercent}%) | GIỮ: ${stats.hold} (${stats.holdPercent}%) | BÁN: ${stats.sell} (${stats.sellPercent}%)\n`
    prompt += `• Đồng thuận: ${stats.consensus}\n`
    if (stats.avgTargetPrice) {
      prompt += `• Giá mục tiêu TB: ${stats.avgTargetPrice.toFixed(2)}\n`
    }
    prompt += `\n`
  }

  // Analysis Instructions
  prompt += `🎯 YÊU CẦU:\n`
  prompt += `1. NGẮN HẠN (1-4 tuần): 70% Kỹ thuật + 30% Cơ bản\n`
  prompt += `2. DÀI HẠN (3-12 tháng): 70% Cơ bản + 30% Kỹ thuật\n`
  prompt += `3. Khuyến nghị: MUA, BÁN, hoặc THEO DÕI\n`
  prompt += `4. Nếu MUA: buyPrice (hỗ trợ), targetPrice (mục tiêu), stopLoss (cắt lỗ 5-7%)\n`
  prompt += `5. ĐÚNG 3 rủi ro và ĐÚNG 3 cơ hội cụ thể\n\n`

  prompt += `📋 TRẢ VỀ JSON (KHÔNG text khác):\n`
  prompt += `{"shortTerm":{"signal":"MUA","confidence":75,"summary":"..."},"longTerm":{"signal":"THEO DÕI","confidence":60,"summary":"..."},"buyPrice":85.5,"targetPrice":95,"stopLoss":80,"risks":["R1","R2","R3"],"opportunities":["O1","O2","O3"]}\n\n`

  prompt += `LƯU Ý: signal chỉ nhận "MUA"/"BÁN"/"THEO DÕI", confidence 0-100, giá x1000 VNĐ (null nếu không MUA), risks/opportunities mỗi array ĐÚNG 3 phần tử.`

  return prompt
}

/**
 * Parse and validate Gemini response
 */
function parseGeminiStockAnalysis(text: string, currentPrice?: number): any {
  console.log('🔍 Parsing Gemini response...')

  // Clean markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Find JSON object
  const startIdx = cleaned.indexOf('{')
  if (startIdx === -1) {
    console.error('❌ No JSON found in response')
    return createDefaultResponse(currentPrice)
  }

  // Find matching closing brace
  let braceCount = 0
  let endIdx = -1
  for (let i = startIdx; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceCount++
    if (cleaned[i] === '}') braceCount--
    if (braceCount === 0) {
      endIdx = i
      break
    }
  }

  if (endIdx === -1) {
    console.error('❌ No closing brace found')
    return createDefaultResponse(currentPrice)
  }

  const jsonStr = cleaned.substring(startIdx, endIdx + 1)

  try {
    // Fix common JSON issues
    let fixedJson = jsonStr
      .replace(/[\x00-\x1F\x7F]/g, ' ')  // Remove control characters
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')  // Quote unquoted keys
      .replace(/'/g, '"')  // Single to double quotes
      .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
      .replace(/"null"/gi, 'null')
      .replace(/"undefined"/gi, 'null')

    const parsed = JSON.parse(fixedJson)
    console.log('✅ JSON parsed successfully')

    // Normalize and validate
    return normalizeResponse(parsed, currentPrice)
  } catch (error) {
    console.error('❌ JSON parse failed:', error)
    return createDefaultResponse(currentPrice)
  }
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

  return result
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
