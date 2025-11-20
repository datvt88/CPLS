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

    // Parse and validate the response
    const result = parseGeminiStockAnalysis(generatedText)

    if (!result) {
      console.error('Failed to parse Gemini response for', symbol)
      return NextResponse.json(
        { error: 'Invalid response format from Gemini AI' },
        { status: 500 }
      )
    }

    console.log('✅ Gemini analysis completed for', symbol)

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
 */
function buildStockAnalysisPrompt(
  symbol: string,
  technicalData?: any,
  fundamentalData?: any,
  recommendations?: any[]
): string {
  let prompt = `Bạn là chuyên gia phân tích chứng khoán. Hãy phân tích cổ phiếu ${symbol} dựa trên dữ liệu sau:\n\n`

  // Technical Analysis Section
  if (technicalData) {
    prompt += `📊 PHÂN TÍCH KỸ THUẬT:\n`
    prompt += `Giá hiện tại: ${technicalData.currentPrice?.toFixed(2)}\n`

    if (technicalData.ma10 && technicalData.ma30) {
      const maDiff = ((technicalData.ma10 - technicalData.ma30) / technicalData.ma30 * 100).toFixed(2)
      prompt += `MA10: ${technicalData.ma10.toFixed(2)} | MA30: ${technicalData.ma30.toFixed(2)} (Chênh lệch: ${maDiff}%)\n`
    }

    if (technicalData.bollinger) {
      const bandPosition = ((technicalData.currentPrice - technicalData.bollinger.lower) /
                           (technicalData.bollinger.upper - technicalData.bollinger.lower) * 100).toFixed(1)
      prompt += `Bollinger Bands: Upper=${technicalData.bollinger.upper.toFixed(2)}, Middle=${technicalData.bollinger.middle.toFixed(2)}, Lower=${technicalData.bollinger.lower.toFixed(2)}\n`
      prompt += `Vị trí giá trong band: ${bandPosition}%\n`
    }

    if (technicalData.momentum) {
      prompt += `Động lượng 5 ngày: ${technicalData.momentum.day5?.toFixed(2)}% | 10 ngày: ${technicalData.momentum.day10?.toFixed(2)}%\n`
    }

    if (technicalData.volume) {
      prompt += `Khối lượng hiện tại: ${technicalData.volume.current?.toLocaleString()} | TB 10 ngày: ${technicalData.volume.avg10?.toLocaleString()} (Tỷ lệ: ${technicalData.volume.ratio?.toFixed(0)}%)\n`
    }

    if (technicalData.week52) {
      const position = ((technicalData.currentPrice - technicalData.week52.low) /
                       (technicalData.week52.high - technicalData.week52.low) * 100).toFixed(0)
      prompt += `52-Week Range: ${technicalData.week52.low?.toFixed(2)} - ${technicalData.week52.high?.toFixed(2)} (Vị trí: ${position}%)\n`
    }

    if (technicalData.buyPrice) {
      prompt += `Giá khuyến nghị mua (Buy T+ S2): ${technicalData.buyPrice.toFixed(2)}\n`
    }

    prompt += `\n`
  }

  // Fundamental Analysis Section
  if (fundamentalData) {
    prompt += `💰 PHÂN TÍCH CƠ BẢN:\n`

    if (fundamentalData.pe !== undefined) {
      prompt += `P/E Ratio: ${fundamentalData.pe.toFixed(2)}\n`
    }

    if (fundamentalData.pb !== undefined) {
      prompt += `P/B Ratio: ${fundamentalData.pb.toFixed(2)}\n`
    }

    if (fundamentalData.roe !== undefined) {
      prompt += `ROE: ${(fundamentalData.roe * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.roa !== undefined) {
      prompt += `ROA: ${(fundamentalData.roa * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.dividendYield !== undefined) {
      prompt += `Dividend Yield: ${(fundamentalData.dividendYield * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.marketCap !== undefined) {
      prompt += `Vốn hóa: ${(fundamentalData.marketCap / 1000000000000).toFixed(2)} nghìn tỷ\n`
    }

    if (fundamentalData.freeFloat !== undefined) {
      prompt += `Free Float: ${(fundamentalData.freeFloat * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.eps !== undefined) {
      prompt += `EPS: ${fundamentalData.eps.toFixed(2)}\n`
    }

    if (fundamentalData.bvps !== undefined) {
      prompt += `BVPS: ${fundamentalData.bvps.toFixed(2)}\n`
    }

    prompt += `\n`
  }

  // Analyst Recommendations Section
  if (recommendations && recommendations.length > 0) {
    prompt += `📋 KHUYẾN NGHỊ TỪ CÁC CÔNG TY CHỨNG KHOÁN:\n`

    // Group recommendations by type
    const buyRecs = recommendations.filter(r => r.type?.toUpperCase() === 'BUY' || r.type?.toUpperCase() === 'MUA')
    const holdRecs = recommendations.filter(r => r.type?.toUpperCase() === 'HOLD' || r.type?.toUpperCase() === 'GIỮ')
    const sellRecs = recommendations.filter(r => r.type?.toUpperCase() === 'SELL' || r.type?.toUpperCase() === 'BÁN')

    prompt += `Tổng số khuyến nghị: ${recommendations.length} (${buyRecs.length} MUA, ${holdRecs.length} GIỮ, ${sellRecs.length} BÁN)\n\n`

    // Show top 5 most recent recommendations
    const topRecs = recommendations.slice(0, 5)
    topRecs.forEach((rec, idx) => {
      prompt += `${idx + 1}. ${rec.firm || 'N/A'} - ${rec.type || 'N/A'} (${rec.reportDate || 'N/A'})\n`
      if (rec.targetPrice) {
        prompt += `   Giá mục tiêu: ${rec.targetPrice}\n`
      }
      if (rec.reportPrice) {
        prompt += `   Giá tại thời điểm báo cáo: ${rec.reportPrice}\n`
      }
    })

    // Calculate consensus
    const totalRecs = recommendations.length
    const buyPercent = ((buyRecs.length / totalRecs) * 100).toFixed(0)
    const holdPercent = ((holdRecs.length / totalRecs) * 100).toFixed(0)
    const sellPercent = ((sellRecs.length / totalRecs) * 100).toFixed(0)

    prompt += `\nĐồng thuận thị trường: ${buyPercent}% MUA, ${holdPercent}% GIỮ, ${sellPercent}% BÁN\n`

    // Calculate average target price if available
    const recsWithTarget = recommendations.filter(r => r.targetPrice && !isNaN(r.targetPrice))
    if (recsWithTarget.length > 0) {
      const avgTarget = recsWithTarget.reduce((sum, r) => sum + r.targetPrice, 0) / recsWithTarget.length
      prompt += `Giá mục tiêu trung bình: ${avgTarget.toFixed(2)} (từ ${recsWithTarget.length} khuyến nghị)\n`
    }

    prompt += `\n`
  }

  // Analysis Instructions
  prompt += `🎯 YÊU CẦU PHÂN TÍCH:\n`
  prompt += `1. Phân tích tổng hợp các chỉ số kỹ thuật và cơ bản\n`
  prompt += `2. Đánh giá xu hướng ngắn hạn (1-4 tuần) và dài hạn (3-12 tháng)\n`
  prompt += `3. Xác định mức hỗ trợ và kháng cự quan trọng\n`
  prompt += `4. Tham khảo đồng thuận từ các công ty chứng khoán (nếu có)\n`
  prompt += `5. Đưa ra khuyến nghị: MUA, BÁN, hoặc NẮM GIỮ\n`
  prompt += `6. Đề xuất mức giá mục tiêu và điểm cắt lỗ (nếu khuyến nghị MUA)\n`
  prompt += `7. Đánh giá rủi ro và cơ hội\n\n`

  prompt += `📋 FORMAT TRẢ VỀ:\n`
  prompt += `BẮT BUỘC trả về ĐÚNG định dạng JSON sau (không thêm markdown, code block, hay text khác):\n\n`
  prompt += `{\n`
  prompt += `  "shortTerm": {\n`
  prompt += `    "signal": "MUA hoặc BÁN hoặc NẮM GIỮ",\n`
  prompt += `    "confidence": <số từ 0 đến 100>,\n`
  prompt += `    "summary": "<phân tích ngắn hạn 2-3 câu>"\n`
  prompt += `  },\n`
  prompt += `  "longTerm": {\n`
  prompt += `    "signal": "MUA hoặc BÁN hoặc NẮM GIỮ",\n`
  prompt += `    "confidence": <số từ 0 đến 100>,\n`
  prompt += `    "summary": "<phân tích dài hạn 2-3 câu>"\n`
  prompt += `  },\n`
  prompt += `  "targetPrice": "<giá mục tiêu VD: 95-100 hoặc null nếu không MUA>",\n`
  prompt += `  "stopLoss": "<mức cắt lỗ VD: 85 hoặc null nếu không MUA>",\n`
  prompt += `  "risks": ["<rủi ro 1>", "<rủi ro 2>", "<rủi ro 3>"],\n`
  prompt += `  "opportunities": ["<cơ hội 1>", "<cơ hội 2>"]\n`
  prompt += `}\n\n`

  prompt += `QUAN TRỌNG:\n`
  prompt += `- Chỉ trả về JSON object, không thêm text giải thích\n`
  prompt += `- Không dùng markdown code block (\`\`\`json)\n`
  prompt += `- Đảm bảo JSON hợp lệ (có thể parse được)\n`
  prompt += `- Các field string phải trong dấu ngoặc kép\n`
  prompt += `- Confidence phải là số nguyên từ 0-100\n`
  prompt += `- Giá mục tiêu và mức cắt lỗ chỉ ghi số, KHÔNG thêm đơn vị VNĐ\n`

  return prompt
}

/**
 * Parse and validate Gemini response
 */
function parseGeminiStockAnalysis(text: string): any {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  // Try to find JSON object in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('No JSON object found in Gemini response')
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    // Validate structure
    if (!parsed.shortTerm || !parsed.longTerm) {
      console.error('Invalid structure: missing shortTerm or longTerm')
      return null
    }

    // Validate signals
    const validSignals = ['MUA', 'BÁN', 'NẮM GIỮ', 'HOLD']
    if (!parsed.shortTerm.signal || !validSignals.some(s => parsed.shortTerm.signal.includes(s))) {
      console.warn('Invalid shortTerm signal, using default')
      parsed.shortTerm.signal = 'NẮM GIỮ'
    }
    if (!parsed.longTerm.signal || !validSignals.some(s => parsed.longTerm.signal.includes(s))) {
      console.warn('Invalid longTerm signal, using default')
      parsed.longTerm.signal = 'NẮM GIỮ'
    }

    // Ensure confidence is a number between 0-100
    parsed.shortTerm.confidence = Math.max(0, Math.min(100, Number(parsed.shortTerm.confidence) || 50))
    parsed.longTerm.confidence = Math.max(0, Math.min(100, Number(parsed.longTerm.confidence) || 50))

    // Format target price and stop loss with 3 decimal places
    if (parsed.targetPrice && parsed.targetPrice !== 'null') {
      parsed.targetPrice = formatGeminiPrice(parsed.targetPrice)
    } else {
      parsed.targetPrice = null
    }

    if (parsed.stopLoss && parsed.stopLoss !== 'null') {
      parsed.stopLoss = formatGeminiPrice(parsed.stopLoss)
    } else {
      parsed.stopLoss = null
    }

    // Ensure arrays
    parsed.risks = Array.isArray(parsed.risks) ? parsed.risks : []
    parsed.opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : []

    return parsed
  } catch (error) {
    console.error('Failed to parse Gemini JSON:', error)
    return null
  }
}

/**
 * Format price from Gemini response (handles ranges like "95-100" or single values like "85.5")
 */
function formatGeminiPrice(price: string | number | null | undefined): string {
  if (!price) return ''

  const priceStr = String(price).trim()

  // Handle range format like "95-100"
  if (priceStr.includes('-')) {
    const parts = priceStr.split('-').map(p => p.trim())
    const formattedParts = parts.map(p => {
      const num = parseFloat(p)
      return isNaN(num) ? p : num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    })
    return formattedParts.join(' - ')
  }

  // Handle single value
  const num = parseFloat(priceStr)
  if (isNaN(num)) return priceStr

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}
