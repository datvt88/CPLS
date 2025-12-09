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

    // Parse and validate the response (always returns a result with fallback)
    const result = parseGeminiStockAnalysis(generatedText)

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

    // Add detailed profitability data if available
    if (fundamentalData.profitability && fundamentalData.profitability.metrics && fundamentalData.profitability.metrics.length > 0) {
      prompt += `\n📈 HIỆU QUẢ HOẠT ĐỘNG (5 QUÝ GẦN NHẤT):\n`

      const { quarters, metrics } = fundamentalData.profitability
      metrics.forEach((metric: any) => {
        if (metric.label && metric.y && metric.y.length > 0) {
          prompt += `\n${metric.label} (%): `
          const reversedQuarters = [...quarters].reverse()
          const reversedValues = [...metric.y].reverse()
          reversedQuarters.forEach((q: string, i: number) => {
            prompt += `${q}: ${reversedValues[i].toFixed(2)}%${i < reversedQuarters.length - 1 ? ', ' : ''}`
          })

          // Calculate trend
          const latest = metric.y[metric.y.length - 1]
          const oldest = metric.y[0]
          const trend = latest - oldest
          const trendPercent = ((trend / oldest) * 100).toFixed(1)

          if (trend > 0) {
            prompt += ` (📈 Xu hướng tăng +${trend.toFixed(2)}%, ${trendPercent}%)\n`
          } else if (trend < 0) {
            prompt += ` (📉 Xu hướng giảm ${trend.toFixed(2)}%, ${trendPercent}%)\n`
          } else {
            prompt += ` (➡️ Ổn định)\n`
          }

          if (metric.tooltip) {
            prompt += `   ${metric.tooltip}\n`
          }
        }
      })
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
  prompt += `3. Phân tích xu hướng ROE/ROA qua các quý (nếu có dữ liệu chi tiết)\n`
  prompt += `4. Xác định mức hỗ trợ và kháng cự quan trọng\n`
  prompt += `5. Tham khảo đồng thuận từ các công ty chứng khoán (nếu có)\n`
  prompt += `6. Đưa ra khuyến nghị: MUA, BÁN, hoặc NẮM GIỮ\n`
  prompt += `7. Đề xuất mức giá mục tiêu và điểm cắt lỗ (nếu khuyến nghị MUA)\n`
  prompt += `8. Đánh giá rủi ro và cơ hội, đặc biệt chú ý đến xu hướng hiệu quả hoạt động\n\n`

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
  console.log('🔍 Parsing Gemini response, length:', text.length)

  // Step 1: Clean up the text - remove markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*json\s*/gi, '')
    .trim()

  // Step 2: Try to find JSON object - use non-greedy match to get the first complete JSON
  // Find opening brace
  const startIdx = cleaned.indexOf('{')
  if (startIdx === -1) {
    console.error('❌ No JSON object found in Gemini response')
    console.log('Raw text preview:', text.substring(0, 500))
    return createFallbackResponse(text)
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
    console.error('❌ No matching closing brace found')
    return createFallbackResponse(text)
  }

  const jsonStr = cleaned.substring(startIdx, endIdx + 1)
  console.log('📝 Extracted JSON length:', jsonStr.length)

  try {
    // Step 3: Fix common JSON issues
    let fixedJson = jsonStr
      // Fix unquoted keys
      .replace(/(\s*)(\w+)(\s*):/g, '$1"$2"$3:')
      // Fix single quotes to double quotes
      .replace(/'/g, '"')
      // Remove trailing commas
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix null strings
      .replace(/"null"/g, 'null')

    const parsed = JSON.parse(fixedJson)

    // Step 4: Validate and fix structure
    if (!parsed.shortTerm && !parsed.longTerm) {
      console.error('❌ Invalid structure: missing both shortTerm and longTerm')
      return createFallbackResponse(text)
    }

    // Create default structures if missing
    if (!parsed.shortTerm) {
      parsed.shortTerm = { signal: 'NẮM GIỮ', confidence: 50, summary: 'Không đủ dữ liệu phân tích ngắn hạn' }
    }
    if (!parsed.longTerm) {
      parsed.longTerm = { signal: 'NẮM GIỮ', confidence: 50, summary: 'Không đủ dữ liệu phân tích dài hạn' }
    }

    // Validate signals
    const validSignals = ['MUA', 'BÁN', 'NẮM GIỮ', 'HOLD', 'BUY', 'SELL']
    if (!parsed.shortTerm.signal || !validSignals.some(s => parsed.shortTerm.signal.toUpperCase().includes(s))) {
      console.warn('⚠️ Invalid shortTerm signal, using default')
      parsed.shortTerm.signal = 'NẮM GIỮ'
    }
    if (!parsed.longTerm.signal || !validSignals.some(s => parsed.longTerm.signal.toUpperCase().includes(s))) {
      console.warn('⚠️ Invalid longTerm signal, using default')
      parsed.longTerm.signal = 'NẮM GIỮ'
    }

    // Ensure summaries exist
    parsed.shortTerm.summary = parsed.shortTerm.summary || 'Đang phân tích...'
    parsed.longTerm.summary = parsed.longTerm.summary || 'Đang phân tích...'

    // Ensure confidence is a number between 0-100
    parsed.shortTerm.confidence = Math.max(0, Math.min(100, Number(parsed.shortTerm.confidence) || 50))
    parsed.longTerm.confidence = Math.max(0, Math.min(100, Number(parsed.longTerm.confidence) || 50))

    // Format target price and stop loss
    if (parsed.targetPrice && parsed.targetPrice !== 'null' && parsed.targetPrice !== null) {
      parsed.targetPrice = formatGeminiPrice(parsed.targetPrice)
    } else {
      parsed.targetPrice = null
    }

    if (parsed.stopLoss && parsed.stopLoss !== 'null' && parsed.stopLoss !== null) {
      parsed.stopLoss = formatGeminiPrice(parsed.stopLoss)
    } else {
      parsed.stopLoss = null
    }

    // Ensure arrays
    parsed.risks = Array.isArray(parsed.risks) ? parsed.risks.filter(r => r && typeof r === 'string') : []
    parsed.opportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities.filter(o => o && typeof o === 'string') : []

    console.log('✅ Successfully parsed Gemini response')
    return parsed
  } catch (error) {
    console.error('❌ Failed to parse Gemini JSON:', error)
    console.log('Attempted to parse:', jsonStr.substring(0, 300))
    return createFallbackResponse(text)
  }
}

/**
 * Create a fallback response when JSON parsing fails
 * Attempts to extract useful information from plain text
 */
function createFallbackResponse(text: string): any {
  console.log('⚠️ Creating fallback response from text')

  // Try to determine signal from text content
  const textLower = text.toLowerCase()
  let signal = 'NẮM GIỮ'
  let confidence = 50

  if (textLower.includes('mua') || textLower.includes('buy') || textLower.includes('tích cực')) {
    signal = 'MUA'
    confidence = 60
  } else if (textLower.includes('bán') || textLower.includes('sell') || textLower.includes('tiêu cực')) {
    signal = 'BÁN'
    confidence = 60
  }

  // Extract any summary-like content (first 200 chars of meaningful text)
  const summaryText = text
    .replace(/[{}"\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200)

  return {
    shortTerm: {
      signal: signal,
      confidence: confidence,
      summary: summaryText || 'Gemini AI đã phân tích nhưng không thể trích xuất kết quả chi tiết.'
    },
    longTerm: {
      signal: signal,
      confidence: confidence,
      summary: 'Vui lòng thử lại để có kết quả phân tích chi tiết hơn.'
    },
    targetPrice: null,
    stopLoss: null,
    risks: ['Không thể trích xuất thông tin rủi ro từ phản hồi AI'],
    opportunities: ['Không thể trích xuất thông tin cơ hội từ phản hồi AI']
  }
}

/**
 * Format price from Gemini response (handles ranges like "95-100" or single values like "85.5")
 */
function formatGeminiPrice(price: string | number | null | undefined): string {
  if (!price) return ''

  const priceStr = String(price).trim()

  // Handle range format like "95-100" or "72-75"
  if (priceStr.includes('-')) {
    const parts = priceStr.split('-').map(p => p.trim())
    const formattedParts = parts.map(p => {
      let num = parseFloat(p)
      if (isNaN(num)) return p

      // If number is too small (< 1000), likely in thousands, multiply by 1000
      if (num < 1000) {
        num = num * 1000
      }

      return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    })
    return formattedParts.join(' - ')
  }

  // Handle single value
  let num = parseFloat(priceStr)
  if (isNaN(num)) return priceStr

  // If number is too small (< 1000), likely in thousands, multiply by 1000
  if (num < 1000) {
    num = num * 1000
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}
