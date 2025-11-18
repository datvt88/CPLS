import { NextRequest, NextResponse } from 'next/server'
import { parseGeminiResponse } from '@/lib/geminiClient'
import { isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/geminiModels'

export async function POST(request: NextRequest) {
  try {
    const { symbol, technicalData, fundamentalData, model } = await request.json()

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

    // Build comprehensive prompt with technical and fundamental data
    const prompt = buildStockAnalysisPrompt(symbol, technicalData, fundamentalData)

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
      return NextResponse.json(
        { error: 'No content generated from Gemini' },
        { status: 500 }
      )
    }

    // Parse the response
    const result = parseGeminiResponse(generatedText)

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
 * Build comprehensive analysis prompt combining technical and fundamental data
 */
function buildStockAnalysisPrompt(
  symbol: string,
  technicalData?: any,
  fundamentalData?: any
): string {
  let prompt = `Bạn là chuyên gia phân tích chứng khoán. Hãy phân tích cổ phiếu ${symbol} dựa trên dữ liệu sau:\n\n`

  // Technical Analysis Section
  if (technicalData) {
    prompt += `📊 PHÂN TÍCH KỸ THUẬT:\n`
    prompt += `Giá hiện tại: ${technicalData.currentPrice?.toFixed(2)} VNĐ\n`

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
      prompt += `Giá khuyến nghị mua (Buy T+ S2): ${technicalData.buyPrice.toFixed(2)} VNĐ\n`
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
      prompt += `Vốn hóa: ${(fundamentalData.marketCap / 1000000000000).toFixed(2)} nghìn tỷ VNĐ\n`
    }

    if (fundamentalData.freeFloat !== undefined) {
      prompt += `Free Float: ${(fundamentalData.freeFloat * 100).toFixed(2)}%\n`
    }

    if (fundamentalData.eps !== undefined) {
      prompt += `EPS: ${fundamentalData.eps.toFixed(2)} VNĐ\n`
    }

    if (fundamentalData.bvps !== undefined) {
      prompt += `BVPS: ${fundamentalData.bvps.toFixed(2)} VNĐ\n`
    }

    prompt += `\n`
  }

  // Analysis Instructions
  prompt += `🎯 YÊU CẦU PHÂN TÍCH:\n`
  prompt += `1. Phân tích tổng hợp các chỉ số kỹ thuật và cơ bản\n`
  prompt += `2. Đánh giá xu hướng ngắn hạn (1-4 tuần) và dài hạn (3-12 tháng)\n`
  prompt += `3. Xác định mức hỗ trợ và kháng cự quan trọng\n`
  prompt += `4. Đưa ra khuyến nghị: MUA, BÁN, hoặc NẮM GIỮ\n`
  prompt += `5. Đề xuất mức giá mục tiêu và điểm cắt lỗ (nếu khuyến nghị MUA)\n`
  prompt += `6. Đánh giá rủi ro và cơ hội\n\n`

  prompt += `📋 FORMAT TRẢ VỀ (JSON):\n`
  prompt += `{\n`
  prompt += `  "shortTerm": {\n`
  prompt += `    "signal": "MUA/BÁN/NẮM GIỮ",\n`
  prompt += `    "confidence": 0-100,\n`
  prompt += `    "summary": "Phân tích ngắn hạn chi tiết"\n`
  prompt += `  },\n`
  prompt += `  "longTerm": {\n`
  prompt += `    "signal": "MUA/BÁN/NẮM GIỮ",\n`
  prompt += `    "confidence": 0-100,\n`
  prompt += `    "summary": "Phân tích dài hạn chi tiết"\n`
  prompt += `  },\n`
  prompt += `  "targetPrice": "giá mục tiêu (nếu MUA)",\n`
  prompt += `  "stopLoss": "mức cắt lỗ (nếu MUA)",\n`
  prompt += `  "risks": ["rủi ro 1", "rủi ro 2"],\n`
  prompt += `  "opportunities": ["cơ hội 1", "cơ hội 2"]\n`
  prompt += `}\n\n`

  prompt += `Lưu ý: Trả về ĐÚNG định dạng JSON, không thêm markdown hay text khác.`

  return prompt
}
