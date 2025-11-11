import { NextRequest, NextResponse } from 'next/server'
import { parseGeminiResponse } from '@/lib/geminiClient'
import { isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/geminiModels'

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

// Calculate MA Amplitude (maximum difference between MA10 and MA30)
function calculateMAAmplitude(ma10: number[], ma30: number[]) {
  let maxBullishDiff = -Infinity  // MA10 > MA30
  let maxBearishDiff = Infinity   // MA10 < MA30
  let maxBullishPct = -Infinity
  let maxBearishPct = Infinity

  for (let i = 0; i < ma10.length; i++) {
    if (!isNaN(ma10[i]) && !isNaN(ma30[i]) && ma30[i] !== 0) {
      const diff = ma10[i] - ma30[i]
      const pctDiff = (diff / ma30[i]) * 100

      if (diff > 0) {
        // Bullish scenario (MA10 > MA30)
        if (pctDiff > maxBullishPct) {
          maxBullishPct = pctDiff
          maxBullishDiff = diff
        }
      } else if (diff < 0) {
        // Bearish scenario (MA10 < MA30)
        if (pctDiff < maxBearishPct) {
          maxBearishPct = pctDiff
          maxBearishDiff = diff
        }
      }
    }
  }

  return {
    maxBullishDiff,
    maxBullishPct,
    maxBearishDiff,
    maxBearishPct
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, user_id, model } = await request.json()

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt' },
        { status: 400 }
      )
    }

    // Validate and set model
    const selectedModel = model && isValidModel(model) ? model : DEFAULT_GEMINI_MODEL
    console.log('🤖 Using Gemini model:', selectedModel)

    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Fetch market data for analysis (supports VNINDEX, VN30, VN30F1M, VN30F2M)
    let marketContext = ''
    const stockCode = prompt.trim().toUpperCase()

    try {
      // Fetch 300 trading days for MA amplitude analysis
      const marketResponse = await fetch(
        `https://api-finfo.vndirect.com.vn/v4/vnmarket_prices?sort=date:desc&size=300&q=code:${stockCode}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (marketResponse.ok) {
        const marketData = await marketResponse.json()

        if (marketData.data && marketData.data.length > 0) {
          // Filter valid dates and sort ascending
          const validData = marketData.data.filter((item: any) => isValidTradingDate(item.date))
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

            // Calculate MA Amplitude for historical context
            const maAmplitude = calculateMAAmplitude(ma10, ma30)

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

            // MA10 vs MA30 logic with amplitude analysis
            const maDiff = ((currentMA10 - currentMA30) / currentMA30) * 100

            // Calculate amplitude thresholds (percentage of max historical amplitude)
            const bullishAmplitudeRatio = maAmplitude.maxBullishPct > 0
              ? (maDiff / maAmplitude.maxBullishPct) * 100
              : 0
            const bearishAmplitudeRatio = maAmplitude.maxBearishPct < 0
              ? (maDiff / maAmplitude.maxBearishPct) * 100
              : 0

            if (currentMA10 > currentMA30) {
              // Bullish scenario
              if (bullishAmplitudeRatio >= 80) {
                maSignal = `MA10 > MA30 (${maDiff.toFixed(2)}%) - GẦN MỨC CHÊNH LỆCH CỰC ĐẠI LỊCH SỬ (${bullishAmplitudeRatio.toFixed(0)}% của max ${maAmplitude.maxBullishPct.toFixed(2)}%) - Khuyến nghị CHỐT LÃI TỪNG PHẦN hoặc CHỐT TOÀN BỘ, thị trường có thể điều chỉnh`
              } else if (bullishAmplitudeRatio >= 60) {
                maSignal = `MA10 > MA30 (${maDiff.toFixed(2)}%) - Đạt ${bullishAmplitudeRatio.toFixed(0)}% mức chênh lệch cực đại (${maAmplitude.maxBullishPct.toFixed(2)}%) - Xu hướng TĂNG MẠNH - Khuyến nghị GIỮ hoặc CHỐT LÃI NHẸ, theo dõi sát`
              } else if (maDiff > 2) {
                maSignal = `MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng TĂNG MẠNH - Khuyến nghị MUA TỶ TRỌNG CAO hoặc GIỮ (còn xa mức chênh lệch cực đại ${maAmplitude.maxBullishPct.toFixed(2)}%)`
              } else {
                maSignal = `MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng tăng - Khuyến nghị MUA hoặc GIỮ`
              }
            } else if (currentMA10 < currentMA30) {
              // Bearish scenario
              if (bearishAmplitudeRatio >= 80) {
                maSignal = `MA10 < MA30 (${maDiff.toFixed(2)}%) - GẦN MỨC CHÊNH LỆCH CỰC ĐẠI LỊCH SỬ (${bearishAmplitudeRatio.toFixed(0)}% của max ${maAmplitude.maxBearishPct.toFixed(2)}%) - Khuyến nghị MUA THĂM DÒ TỶ TRỌNG NHỎ, thị trường có thể phục hồi`
              } else if (bearishAmplitudeRatio >= 60) {
                maSignal = `MA10 < MA30 (${maDiff.toFixed(2)}%) - Đạt ${bearishAmplitudeRatio.toFixed(0)}% mức chênh lệch cực đại (${maAmplitude.maxBearishPct.toFixed(2)}%) - Xu hướng GIẢM MẠNH - Khuyến nghị ĐỨNG NGOÀI hoặc BÁN CHƯA MUỘN, theo dõi sát`
              } else if (maDiff < -2) {
                maSignal = `MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng GIẢM MẠNH - Khuyến nghị BÁN TỶ TRỌNG CAO hoặc ĐỨNG NGOÀI (còn xa mức chênh lệch cực đại ${maAmplitude.maxBearishPct.toFixed(2)}%)`
              } else {
                maSignal = `MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng giảm - Khuyến nghị BÁN hoặc GIẢM TỶ TRỌNG`
              }
            } else {
              maSignal = 'MA10 ≈ MA30 - Xu hướng đi ngang'
            }

            marketContext = `
📊 DỮ LIỆU THỊ TRƯỜNG ${stockCode} (${latestData.date}):
📅 Dữ liệu phân tích: ${sortedData.length} phiên giao dịch (khoảng ${Math.round(sortedData.length / 250 * 12)} tháng)

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

📊 BIÊN ĐỘ MA10-MA30 (Phân tích ${sortedData.length} phiên):
- Chênh lệch CỰC ĐẠI khi MA10 > MA30: ${maAmplitude.maxBullishPct.toFixed(2)}% (${maAmplitude.maxBullishDiff.toFixed(2)} điểm)
- Chênh lệch CỰC ĐẠI khi MA10 < MA30: ${maAmplitude.maxBearishPct.toFixed(2)}% (${maAmplitude.maxBearishDiff.toFixed(2)} điểm)
- Tỷ lệ hiện tại so với cực đại: ${currentMA10 > currentMA30 ? `${bullishAmplitudeRatio.toFixed(0)}% (xu hướng tăng)` : `${bearishAmplitudeRatio.toFixed(0)}% (xu hướng giảm)`}

🎯 TÍN HIỆU KỸ THUẬT:

1️⃣ Bollinger Bands: ${bbSignal}

2️⃣ Moving Average: ${maSignal}

📋 QUY TẮC PHÂN TÍCH:
- Nếu giá ≤ 20% band (gần lower band) → Tín hiệu MUA THĂM DÒ
- Nếu giá ≥ 80% band (gần upper band) → Tín hiệu CHỐT LÃI TỪNG PHẦN
- Nếu MA10 > MA30 và chênh lệch >2% → Tín hiệu MUA TỶ TRỌNG CAO
- Nếu MA10 < MA30 và chênh lệch >2% → Tín hiệu BÁN TỶ TRỌNG CAO

📈 QUY TẮC BIÊN ĐỘ MA10-MA30:
- Khi MA10 > MA30 và đạt ≥80% mức chênh lệch cực đại lịch sử → CHỐT LÃI (có thể đảo chiều)
- Khi MA10 > MA30 và đạt 60-80% mức chênh lệch cực đại → GIỮ/CHỐT LÃI NHẸ (theo dõi sát)
- Khi MA10 < MA30 và đạt ≥80% mức chênh lệch cực đại lịch sử → MUA THĂM DÒ (có thể phục hồi)
- Khi MA10 < MA30 và đạt 60-80% mức chênh lệch cực đại → ĐỨNG NGOÀI/BÁN (theo dõi sát)

Vui lòng phân tích tổng hợp các tín hiệu trên và đưa ra khuyến nghị trading cho ${stockCode}.
`
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching ${stockCode} data:`, err)
      // Continue without market context
    }

    // Build prompt for Gemini
    const finalPrompt = marketContext
      ? marketContext + '\n\nTrả về JSON với format: {"signal": "BUY|SELL|HOLD", "confidence": 0-100, "summary": "mô tả chi tiết dựa trên phân tích kỹ thuật trên"}'
      : `Phân tích tín hiệu trading cho ${prompt}. Trả về JSON với format: {"signal": "BUY|SELL|HOLD", "confidence": 0-100, "summary": "mô tả chi tiết"}`

    // Call Gemini API with selected model
    // Note: API key should be passed in header, not query parameter
    console.log('🔄 Calling Gemini API for prompt:', prompt)
    console.log('📝 Market context available:', !!marketContext)

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

    console.log('📡 Gemini API response status:', response.status)

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
