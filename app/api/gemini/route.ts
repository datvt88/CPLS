import { NextRequest, NextResponse } from 'next/server'
import { geminiHub, parseSignalResponse, isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/gemini'

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

// Calculate MA Amplitude
function calculateMAAmplitude(ma10: number[], ma30: number[]) {
  let maxBullishPct = -Infinity
  let maxBearishPct = Infinity
  let maxBullishDiff = -Infinity
  let maxBearishDiff = Infinity

  for (let i = 0; i < ma10.length; i++) {
    if (!isNaN(ma10[i]) && !isNaN(ma30[i]) && ma30[i] !== 0) {
      const diff = ma10[i] - ma30[i]
      const pctDiff = (diff / ma30[i]) * 100

      if (diff > 0 && pctDiff > maxBullishPct) {
        maxBullishPct = pctDiff
        maxBullishDiff = diff
      } else if (diff < 0 && pctDiff < maxBearishPct) {
        maxBearishPct = pctDiff
        maxBearishDiff = diff
      }
    }
  }

  return { maxBullishDiff, maxBullishPct, maxBearishDiff, maxBearishPct }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, user_id, model } = await request.json()

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 })
    }

    // Check API configuration
    if (!geminiHub.isConfigured()) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // Validate model
    const selectedModel = model && isValidModel(model) ? model : DEFAULT_GEMINI_MODEL
    console.log('🤖 Gemini API: Using model:', selectedModel)

    // Fetch market data for analysis
    let marketContext = ''
    const stockCode = prompt.trim().toUpperCase()

    try {
      const marketResponse = await fetch(
        `https://api-finfo.vndirect.com.vn/v4/vnmarket_prices?sort=date:desc&size=300&q=code:${stockCode}`,
        { headers: { 'Accept': 'application/json' } }
      )

      if (marketResponse.ok) {
        const marketData = await marketResponse.json()

        if (marketData.data?.length > 0) {
          const validData = marketData.data.filter((item: any) => isValidTradingDate(item.date))
          const sortedData = validData.sort((a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
          )

          if (sortedData.length >= 30) {
            const closePrices = sortedData.map((d: any) => d.close)
            const latestData = sortedData[sortedData.length - 1]

            // Calculate technical indicators
            const bb = calculateBollingerBands(closePrices, 20, 2)
            const ma10 = calculateSMA(closePrices, 10)
            const ma30 = calculateSMA(closePrices, 30)
            const maAmplitude = calculateMAAmplitude(ma10, ma30)

            const latestIdx = closePrices.length - 1
            const currentPrice = latestData.close
            const upperBand = bb.upper[latestIdx]
            const lowerBand = bb.lower[latestIdx]
            const middleBand = bb.middle[latestIdx]
            const currentMA10 = ma10[latestIdx]
            const currentMA30 = ma30[latestIdx]

            const bandPosition = (currentPrice - lowerBand) / (upperBand - lowerBand)
            const maDiff = ((currentMA10 - currentMA30) / currentMA30) * 100

            // Calculate amplitude ratios
            const bullishAmplitudeRatio = maAmplitude.maxBullishPct > 0
              ? (maDiff / maAmplitude.maxBullishPct) * 100 : 0
            const bearishAmplitudeRatio = maAmplitude.maxBearishPct < 0
              ? (maDiff / maAmplitude.maxBearishPct) * 100 : 0

            // Determine signals
            let bbSignal = ''
            if (bandPosition <= 0.2) bbSignal = 'GIÁ GẦN SÁT LOWER BAND - Khuyến nghị MUA THĂM DÒ'
            else if (bandPosition >= 0.8) bbSignal = 'GIÁ GẦN SÁT UPPER BAND - Khuyến nghị CHỐT LÃI'
            else if (bandPosition < 0.4) bbSignal = 'Giá ở vùng hỗ trợ - Có thể cân nhắc mua'
            else if (bandPosition > 0.6) bbSignal = 'Giá ở vùng kháng cự - Cân nhắc giảm tỷ trọng'
            else bbSignal = 'Giá ở giữa band - Trung tính'

            let maSignal = ''
            if (currentMA10 > currentMA30) {
              if (bullishAmplitudeRatio >= 80) {
                maSignal = `MA10 > MA30 (${maDiff.toFixed(2)}%) - GẦN CỰC ĐẠI - Khuyến nghị CHỐT LÃI`
              } else if (maDiff > 2) {
                maSignal = `MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng TĂNG MẠNH - Khuyến nghị MUA`
              } else {
                maSignal = `MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng tăng - Khuyến nghị MUA hoặc GIỮ`
              }
            } else if (currentMA10 < currentMA30) {
              if (bearishAmplitudeRatio >= 80) {
                maSignal = `MA10 < MA30 (${maDiff.toFixed(2)}%) - GẦN CỰC ĐẠI - Khuyến nghị MUA THĂM DÒ`
              } else if (maDiff < -2) {
                maSignal = `MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng GIẢM MẠNH - Khuyến nghị BÁN`
              } else {
                maSignal = `MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng giảm - Khuyến nghị BÁN hoặc GIẢM TỶ TRỌNG`
              }
            } else {
              maSignal = 'MA10 ≈ MA30 - Xu hướng đi ngang'
            }

            marketContext = `
📊 DỮ LIỆU THỊ TRƯỜNG ${stockCode} (${latestData.date}):
📅 Dữ liệu phân tích: ${sortedData.length} phiên giao dịch

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

Vui lòng phân tích tổng hợp các tín hiệu trên và đưa ra khuyến nghị trading cho ${stockCode}.
`
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching ${stockCode} data:`, err)
    }

    // Build final prompt
    const finalPrompt = marketContext
      ? marketContext + '\n\nTrả về JSON với format: {"signal": "BUY|SELL|HOLD", "confidence": 0-100, "summary": "mô tả chi tiết"}'
      : `Phân tích tín hiệu trading cho ${prompt}. Trả về JSON với format: {"signal": "BUY|SELL|HOLD", "confidence": 0-100, "summary": "mô tả chi tiết"}`

    console.log('🔄 Calling Gemini API via Hub for:', stockCode)

    // Call Gemini via Hub
    const generatedText = await geminiHub.callGeminiAPI(finalPrompt, selectedModel)

    // Parse response
    const result = parseSignalResponse(generatedText)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
