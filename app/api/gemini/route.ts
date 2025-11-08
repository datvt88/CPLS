import { NextRequest, NextResponse } from 'next/server'
import { parseGeminiResponse } from '@/lib/geminiClient'

// Helper function to get current date in Vietnam timezone (GMT+7)
function getVietnamDate(): Date {
  const now = new Date()
  const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  vietnamTime.setHours(0, 0, 0, 0)
  return vietnamTime
}

// Helper function to validate trading date
function isValidTradingDate(dateStr: string): boolean {
  const dataDate = new Date(dateStr)
  dataDate.setHours(0, 0, 0, 0)
  const today = getVietnamDate()
  return dataDate <= today
}

// Calculate Simple Moving Average
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN)
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
  }
  return result
}

// Calculate Standard Deviation
function calculateStdDev(data: number[], period: number, index: number): number {
  if (index < period - 1) return NaN
  const subset = data.slice(index - period + 1, index + 1)
  const mean = subset.reduce((a, b) => a + b, 0) / period
  const squaredDiffs = subset.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period
  return Math.sqrt(variance)
}

// Calculate Bollinger Bands
function calculateBollingerBands(closePrices: number[], period: number = 20, stdDev: number = 2) {
  const middleBand = calculateSMA(closePrices, period)
  const upper: number[] = []
  const lower: number[] = []

  for (let i = 0; i < closePrices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN)
      lower.push(NaN)
    } else {
      const sd = calculateStdDev(closePrices, period, i)
      upper.push(middleBand[i] + stdDev * sd)
      lower.push(middleBand[i] - stdDev * sd)
    }
  }

  return { upper, middle: middleBand, lower }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, user_id } = await request.json()

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt' },
        { status: 400 }
      )
    }

    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Fetch VNINDEX data for analysis
    let marketContext = ''

    try {
      const vnindexResponse = await fetch(
        'https://api-finfo.vndirect.com.vn/v4/vnmarket_prices?sort=date:desc&size=50&q=code:VNINDEX',
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (vnindexResponse.ok) {
        const vnindexData = await vnindexResponse.json()

        if (vnindexData.data && vnindexData.data.length > 0) {
          // Filter valid dates and sort ascending
          const validData = vnindexData.data.filter((item: any) => isValidTradingDate(item.date))
          const sortedData = validData.sort((a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          )

          if (sortedData.length >= 30) {
            // Extract close prices
            const closePrices = sortedData.map((d: any) => d.close)
            const latestData = sortedData[sortedData.length - 1]

            // Calculate technical indicators
            const bb = calculateBollingerBands(closePrices, 20, 2)
            const ma10 = calculateSMA(closePrices, 10)
            const ma30 = calculateSMA(closePrices, 30)

            // Get latest values
            const latestIdx = closePrices.length - 1
            const currentPrice = latestData.close
            const upperBand = bb.upper[latestIdx]
            const lowerBand = bb.lower[latestIdx]
            const middleBand = bb.middle[latestIdx]
            const currentMA10 = ma10[latestIdx]
            const currentMA30 = ma30[latestIdx]

            // Calculate band position (0 = lower band, 1 = upper band)
            const bandPosition = (currentPrice - lowerBand) / (upperBand - lowerBand)

            // Determine signals based on technical analysis
            let bbSignal = ''
            let maSignal = ''

            // Bollinger Bands logic
            if (bandPosition <= 0.2) {
              bbSignal = 'GIÁ GẦN SÁT LOWER BAND (dưới 20% band) - Khuyến nghị MUA THĂM DÒ với tỷ trọng nhỏ'
            } else if (bandPosition >= 0.8) {
              bbSignal = 'GIÁ GẦN SÁT UPPER BAND (trên 80% band) - Khuyến nghị CHỐT LÃI TỪNG PHẦN'
            } else if (bandPosition < 0.4) {
              bbSignal = 'Giá ở vùng hỗ trợ (20-40% band) - Có thể cân nhắc mua'
            } else if (bandPosition > 0.6) {
              bbSignal = 'Giá ở vùng kháng cự (60-80% band) - Cân nhắc giảm tỷ trọng'
            } else {
              bbSignal = 'Giá ở giữa band - Trung tính'
            }

            // MA10 vs MA30 logic
            const maDiff = ((currentMA10 - currentMA30) / currentMA30) * 100

            if (currentMA10 > currentMA30) {
              if (maDiff > 2) {
                maSignal = 'MA10 > MA30 (chênh lệch >2%) - Xu hướng TĂNG MẠNH - Khuyến nghị MUA TỶ TRỌNG CAO'
              } else {
                maSignal = 'MA10 > MA30 - Xu hướng tăng - Khuyến nghị mua'
              }
            } else if (currentMA10 < currentMA30) {
              if (maDiff < -2) {
                maSignal = 'MA10 < MA30 (chênh lệch >2%) - Xu hướng GIẢM MẠNH - Khuyến nghị BÁN TỶ TRỌNG CAO'
              } else {
                maSignal = 'MA10 < MA30 - Xu hướng giảm - Khuyến nghị bán hoặc giảm tỷ trọng'
              }
            } else {
              maSignal = 'MA10 ≈ MA30 - Xu hướng đi ngang'
            }

            marketContext = `
📊 DỮ LIỆU THỊ TRƯỜNG VNINDEX (${latestData.date}):

Giá hiện tại: ${currentPrice.toFixed(2)} điểm
Thay đổi: ${latestData.change >= 0 ? '+' : ''}${latestData.change.toFixed(2)} (${latestData.pctChange >= 0 ? '+' : ''}${latestData.pctChange.toFixed(2)}%)

📈 BOLLINGER BANDS (20, 2):
- Upper Band: ${upperBand.toFixed(2)}
- Middle Band (MA20): ${middleBand.toFixed(2)}
- Lower Band: ${lowerBand.toFixed(2)}
- Vị trí giá trong band: ${(bandPosition * 100).toFixed(1)}%

📉 MOVING AVERAGES:
- MA10: ${currentMA10.toFixed(2)}
- MA30: ${currentMA30.toFixed(2)}
- Chênh lệch MA10-MA30: ${maDiff >= 0 ? '+' : ''}${maDiff.toFixed(2)}%

🎯 TÍN HIỆU KỸ THUẬT:

1️⃣ Bollinger Bands: ${bbSignal}

2️⃣ Moving Average: ${maSignal}

📋 QUY TẮC PHÂN TÍCH:
- Nếu giá ≤ 20% band (gần lower band) → Tín hiệu MUA THĂM DÒ
- Nếu giá ≥ 80% band (gần upper band) → Tín hiệu CHỐT LÃI TỪNG PHẦN
- Nếu MA10 > MA30 và chênh lệch >2% → Tín hiệu MUA TỶ TRỌNG CAO
- Nếu MA10 < MA30 và chênh lệch >2% → Tín hiệu BÁN TỶ TRỌNG CAO

Vui lòng phân tích tổng hợp các tín hiệu trên và đưa ra khuyến nghị trading cho ${prompt}.
`
          }
        }
      }
    } catch (err) {
      console.error('Error fetching VNINDEX data:', err)
      // Continue without market context
    }

    // Build prompt for Gemini
    const finalPrompt = marketContext
      ? marketContext + '\n\nTrả về JSON với format: {"signal": "BUY|SELL|HOLD", "confidence": 0-100, "summary": "mô tả chi tiết dựa trên phân tích kỹ thuật trên"}'
      : `Phân tích tín hiệu trading cho ${prompt}. Trả về JSON với format: {"signal": "BUY|SELL|HOLD", "confidence": 0-100, "summary": "mô tả chi tiết"}`

    // Call Gemini API (using gemini-1.5-flash for better performance and availability)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: finalPrompt,
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
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)

      // Provide more specific error messages
      let errorMessage = 'Failed to generate signal from Gemini API'
      if (response.status === 400) {
        errorMessage = 'Invalid request to Gemini API. Please check the prompt format.'
      } else if (response.status === 403) {
        errorMessage = 'API key is invalid or has been disabled. Please check your Vercel environment variables.'
      } else if (response.status === 404) {
        errorMessage = 'Gemini API model not found. The model may have been deprecated.'
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

    return NextResponse.json(result)
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
