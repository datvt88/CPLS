'use client'

import { useState, useEffect } from 'react'
import { fetchStockPrices, fetchFinancialRatios, calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import { fetchRecommendationsClient } from '@/services/vndirect-client'
import type { FinancialRatio, StockRecommendation } from '@/types/vndirect'

interface StockAIEvaluationWidgetProps {
  symbol: string
}

type Signal = 'MUA' | 'BÁN' | 'NẮM GIỮ'

interface Evaluation {
  signal: Signal
  confidence: number
  reasons: string[]
  currentPrice?: number
  buyPrice?: number
  cutLossPrice?: number
}

interface AIAnalysis {
  shortTerm: Evaluation
  longTerm: Evaluation
}

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

export default function StockAIEvaluationWidget({ symbol }: StockAIEvaluationWidgetProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Reset analysis when symbol changes
    setAnalysis(null)

    const performAnalysis = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('🤖 Performing AI analysis for:', symbol)

        // Fetch technical, fundamental, and recommendations data
        const [pricesResponse, ratiosResponse, recommendationsResponse] = await Promise.all([
          fetchStockPrices(symbol, 150),
          fetchFinancialRatios(symbol),
          fetchRecommendationsClient(symbol).catch(() => ({ data: [] })) // Graceful fallback if no recommendations
        ])

        if (!pricesResponse.data || pricesResponse.data.length === 0) {
          throw new Error('Không có dữ liệu giá')
        }

        // Process technical data
        const validData = pricesResponse.data.filter(item => isValidTradingDate(item.date))
        const sortedData = [...validData].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        // Process fundamental data
        const ratiosMap: Record<string, FinancialRatio> = {}
        ratiosResponse.data.forEach(ratio => {
          ratiosMap[ratio.ratioCode] = ratio
        })

        // Perform analysis
        const aiAnalysis = analyzeStock(sortedData, ratiosMap, recommendationsResponse.data)
        console.log('✅ AI analysis completed for:', symbol)
        setAnalysis(aiAnalysis)
      } catch (err) {
        console.error('❌ Error performing AI analysis:', err)
        setError('Không thể phân tích AI cho mã này')
      } finally {
        setLoading(false)
      }
    }

    performAnalysis()
  }, [symbol])

  const analyzeStock = (priceData: any[], ratios: Record<string, FinancialRatio>, recommendations: StockRecommendation[]): AIAnalysis => {
    // Short-term: 70% Technical + 30% Fundamental
    const shortTerm = analyzeShortTerm(priceData, ratios)

    // Long-term: 70% Fundamental + 20% Technical + 10% Analyst Recommendations
    const longTerm = analyzeLongTerm(priceData, ratios, recommendations)

    return { shortTerm, longTerm }
  }

  const analyzeShortTerm = (priceData: any[], ratios: Record<string, FinancialRatio>): Evaluation => {
    const reasons: string[] = []
    let bullishScore = 0
    let bearishScore = 0
    let totalWeight = 0

    if (priceData.length < 30) {
      return {
        signal: 'NẮM GIỮ',
        confidence: 0,
        reasons: ['Không đủ dữ liệu để phân tích']
      }
    }

    const closePrices = priceData.map(d => d.adClose)
    const currentPrice = closePrices[closePrices.length - 1]
    const volumes = priceData.map(d => d.nmVolume)

    // ============ TECHNICAL ANALYSIS: 70% ============

    // 1. Moving Averages Analysis (Weight: 20%)
    const ma10 = calculateSMA(closePrices, 10)
    const ma30 = calculateSMA(closePrices, 30)
    const currentMA10 = ma10[ma10.length - 1]
    const currentMA30 = ma30[ma30.length - 1]

    if (!isNaN(currentMA10) && !isNaN(currentMA30)) {
      const maDiff = ((currentMA10 - currentMA30) / currentMA30) * 100

      if (currentMA10 > currentMA30) {
        if (maDiff > 2) {
          bullishScore += 20
          reasons.push(`✅ MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng tăng mạnh`)
        } else {
          bullishScore += 13
          reasons.push(`✅ MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng tăng nhẹ`)
        }
      } else {
        if (maDiff < -2) {
          bearishScore += 20
          reasons.push(`❌ MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng giảm mạnh`)
        } else {
          bearishScore += 13
          reasons.push(`❌ MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng giảm nhẹ`)
        }
      }
      totalWeight += 20
    }

    // 2. Bollinger Bands Analysis (Weight: 18%)
    const bb = calculateBollingerBands(closePrices, 20, 2)
    const currentBBUpper = bb.upper[bb.upper.length - 1]
    const currentBBLower = bb.lower[bb.lower.length - 1]

    if (!isNaN(currentBBUpper) && !isNaN(currentBBLower)) {
      const bandPosition = (currentPrice - currentBBLower) / (currentBBUpper - currentBBLower)

      if (bandPosition <= 0.2) {
        bullishScore += 18
        reasons.push(`✅ Giá gần sát Lower Band (${(bandPosition * 100).toFixed(1)}%) - Vùng mua`)
      } else if (bandPosition >= 0.8) {
        bearishScore += 18
        reasons.push(`❌ Giá gần sát Upper Band (${(bandPosition * 100).toFixed(1)}%) - Vùng bán`)
      } else if (bandPosition < 0.4) {
        bullishScore += 10
        reasons.push(`✅ Giá ở vùng hỗ trợ (${(bandPosition * 100).toFixed(1)}%)`)
      } else if (bandPosition > 0.6) {
        bearishScore += 10
        reasons.push(`❌ Giá ở vùng kháng cự (${(bandPosition * 100).toFixed(1)}%)`)
      }
      totalWeight += 18
    }

    // 3. Price Momentum (Weight: 15%)
    const priceChange5D = ((currentPrice - closePrices[closePrices.length - 6]) / closePrices[closePrices.length - 6]) * 100
    const priceChange10D = ((currentPrice - closePrices[closePrices.length - 11]) / closePrices[closePrices.length - 11]) * 100

    if (priceChange5D > 3 && priceChange10D > 5) {
      bullishScore += 15
      reasons.push(`✅ Tăng mạnh 5 ngày (+${priceChange5D.toFixed(2)}%) và 10 ngày (+${priceChange10D.toFixed(2)}%)`)
    } else if (priceChange5D < -3 && priceChange10D < -5) {
      bearishScore += 15
      reasons.push(`❌ Giảm mạnh 5 ngày (${priceChange5D.toFixed(2)}%) và 10 ngày (${priceChange10D.toFixed(2)}%)`)
    } else if (priceChange5D > 0) {
      bullishScore += 8
      reasons.push(`✅ Tăng nhẹ 5 ngày (+${priceChange5D.toFixed(2)}%)`)
    } else if (priceChange5D < 0) {
      bearishScore += 8
      reasons.push(`❌ Giảm nhẹ 5 ngày (${priceChange5D.toFixed(2)}%)`)
    }
    totalWeight += 15

    // 4. Volume Analysis (Weight: 12%)
    const avgVolume10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const currentVolume = volumes[volumes.length - 1]
    const volumeRatio = currentVolume / avgVolume10

    if (volumeRatio > 1.5 && priceChange5D > 0) {
      bullishScore += 12
      reasons.push(`✅ Khối lượng tăng mạnh (${(volumeRatio * 100).toFixed(0)}% TB) với giá tăng`)
    } else if (volumeRatio > 1.5 && priceChange5D < 0) {
      bearishScore += 12
      reasons.push(`❌ Khối lượng tăng mạnh (${(volumeRatio * 100).toFixed(0)}% TB) với giá giảm`)
    } else if (volumeRatio < 0.7) {
      reasons.push(`⚠️ Khối lượng thấp (${(volumeRatio * 100).toFixed(0)}% TB)`)
    }
    totalWeight += 12

    // 5. 52-Week High/Low (Weight: 5%)
    const high52W = Math.max(...closePrices)
    const low52W = Math.min(...closePrices)
    const pricePosition = (currentPrice - low52W) / (high52W - low52W)

    if (pricePosition < 0.3) {
      bullishScore += 5
      reasons.push(`✅ Giá gần đáy 52 tuần (${(pricePosition * 100).toFixed(0)}%)`)
    } else if (pricePosition > 0.7) {
      bearishScore += 5
      reasons.push(`❌ Giá gần đỉnh 52 tuần (${(pricePosition * 100).toFixed(0)}%)`)
    }
    totalWeight += 5

    // ============ FUNDAMENTAL ANALYSIS: 30% ============

    // 6. P/E Ratio Analysis (Weight: 12%)
    const pe = ratios['PRICE_TO_EARNINGS']?.value
    if (pe !== undefined && pe !== null) {
      if (pe > 0 && pe < 10) {
        bullishScore += 12
        reasons.push(`✅ P/E thấp (${pe.toFixed(2)}) - Định giá hấp dẫn`)
      } else if (pe >= 10 && pe <= 20) {
        bullishScore += 7
        reasons.push(`✅ P/E hợp lý (${pe.toFixed(2)})`)
      } else if (pe > 20 && pe <= 30) {
        bearishScore += 5
        reasons.push(`⚠️ P/E cao (${pe.toFixed(2)}) - Cần thận trọng`)
      } else if (pe > 30) {
        bearishScore += 12
        reasons.push(`❌ P/E rất cao (${pe.toFixed(2)}) - Định giá cao`)
      } else if (pe < 0) {
        bearishScore += 10
        reasons.push(`❌ P/E âm (${pe.toFixed(2)}) - Công ty lỗ`)
      }
      totalWeight += 12
    }

    // 7. ROE Analysis (Weight: 10%)
    const roe = ratios['ROAE_TR_AVG5Q']?.value
    if (roe !== undefined && roe !== null) {
      const roePercent = roe * 100
      if (roePercent > 20) {
        bullishScore += 10
        reasons.push(`✅ ROE cao (${roePercent.toFixed(2)}%) - Hiệu quả sử dụng vốn tốt`)
      } else if (roePercent >= 15 && roePercent <= 20) {
        bullishScore += 6
        reasons.push(`✅ ROE tốt (${roePercent.toFixed(2)}%)`)
      } else if (roePercent >= 10 && roePercent < 15) {
        bullishScore += 3
        reasons.push(`⚠️ ROE trung bình (${roePercent.toFixed(2)}%)`)
      } else if (roePercent < 10 && roePercent > 0) {
        bearishScore += 5
        reasons.push(`❌ ROE thấp (${roePercent.toFixed(2)}%)`)
      } else {
        bearishScore += 10
        reasons.push(`❌ ROE âm (${roePercent.toFixed(2)}%) - Công ty lỗ`)
      }
      totalWeight += 10
    }

    // 8. P/B Ratio Analysis (Weight: 8%)
    const pb = ratios['PRICE_TO_BOOK']?.value
    if (pb !== undefined && pb !== null) {
      if (pb < 1) {
        bullishScore += 8
        reasons.push(`✅ P/B < 1 (${pb.toFixed(2)}) - Giá thấp hơn giá trị sổ sách`)
      } else if (pb >= 1 && pb <= 2) {
        bullishScore += 4
        reasons.push(`✅ P/B hợp lý (${pb.toFixed(2)})`)
      } else if (pb > 2 && pb <= 3) {
        bearishScore += 3
        reasons.push(`⚠️ P/B cao (${pb.toFixed(2)})`)
      } else if (pb > 3) {
        bearishScore += 8
        reasons.push(`❌ P/B rất cao (${pb.toFixed(2)}) - Định giá cao so với tài sản`)
      }
      totalWeight += 8
    }

    // Calculate final signal and confidence
    const netScore = bullishScore - bearishScore
    const confidence = Math.min(Math.abs(netScore), 100)

    let signal: Signal
    if (netScore > 15) {
      signal = 'MUA'
    } else if (netScore < -15) {
      signal = 'BÁN'
    } else {
      signal = 'NẮM GIỮ'
    }

    // Calculate pivot points for Buy T+ recommendation
    let buyPrice: number | undefined
    let cutLossPrice: number | undefined

    if (priceData.length >= 2) {
      const prevDay = priceData[priceData.length - 2]
      const pivots = calculateWoodiePivotPoints(prevDay.adHigh, prevDay.adLow, prevDay.adClose)
      buyPrice = pivots.S2 // Buy T+ is S2 support level
    }

    // Calculate cut loss price (3.5% below current price)
    cutLossPrice = Number((currentPrice * 0.965).toFixed(2))

    return {
      signal,
      confidence,
      reasons,
      currentPrice: Number(currentPrice.toFixed(2)),
      buyPrice,
      cutLossPrice
    }
  }

  const analyzeLongTerm = (priceData: any[], ratios: Record<string, FinancialRatio>, recommendations: StockRecommendation[]): Evaluation => {
    const reasons: string[] = []
    let bullishScore = 0
    let bearishScore = 0
    let totalWeight = 0

    // ============ FUNDAMENTAL ANALYSIS: 70% ============

    // 1. P/E Ratio Analysis (Weight: 20%)
    const pe = ratios['PRICE_TO_EARNINGS']?.value
    if (pe !== undefined && pe !== null) {
      if (pe > 0 && pe < 10) {
        bullishScore += 20
        reasons.push(`✅ P/E thấp (${pe.toFixed(2)}) - Định giá hấp dẫn`)
      } else if (pe >= 10 && pe <= 20) {
        bullishScore += 12
        reasons.push(`✅ P/E hợp lý (${pe.toFixed(2)})`)
      } else if (pe > 20 && pe <= 30) {
        bearishScore += 8
        reasons.push(`⚠️ P/E cao (${pe.toFixed(2)}) - Cần thận trọng`)
      } else if (pe > 30) {
        bearishScore += 20
        reasons.push(`❌ P/E rất cao (${pe.toFixed(2)}) - Định giá cao`)
      } else if (pe < 0) {
        bearishScore += 16
        reasons.push(`❌ P/E âm (${pe.toFixed(2)}) - Công ty lỗ`)
      }
      totalWeight += 20
    }

    // 2. ROE Analysis (Weight: 18%)
    const roe = ratios['ROAE_TR_AVG5Q']?.value
    if (roe !== undefined && roe !== null) {
      const roePercent = roe * 100
      if (roePercent > 20) {
        bullishScore += 18
        reasons.push(`✅ ROE cao (${roePercent.toFixed(2)}%) - Hiệu quả sử dụng vốn tốt`)
      } else if (roePercent >= 15 && roePercent <= 20) {
        bullishScore += 12
        reasons.push(`✅ ROE tốt (${roePercent.toFixed(2)}%)`)
      } else if (roePercent >= 10 && roePercent < 15) {
        bullishScore += 6
        reasons.push(`⚠️ ROE trung bình (${roePercent.toFixed(2)}%)`)
      } else if (roePercent < 10 && roePercent > 0) {
        bearishScore += 9
        reasons.push(`❌ ROE thấp (${roePercent.toFixed(2)}%)`)
      } else {
        bearishScore += 18
        reasons.push(`❌ ROE âm (${roePercent.toFixed(2)}%) - Công ty lỗ`)
      }
      totalWeight += 18
    }

    // 3. P/B Ratio Analysis (Weight: 15%)
    const pb = ratios['PRICE_TO_BOOK']?.value
    if (pb !== undefined && pb !== null) {
      if (pb < 1) {
        bullishScore += 15
        reasons.push(`✅ P/B < 1 (${pb.toFixed(2)}) - Giá thấp hơn giá trị sổ sách`)
      } else if (pb >= 1 && pb <= 2) {
        bullishScore += 8
        reasons.push(`✅ P/B hợp lý (${pb.toFixed(2)})`)
      } else if (pb > 2 && pb <= 3) {
        bearishScore += 5
        reasons.push(`⚠️ P/B cao (${pb.toFixed(2)})`)
      } else if (pb > 3) {
        bearishScore += 15
        reasons.push(`❌ P/B rất cao (${pb.toFixed(2)}) - Định giá cao so với tài sản`)
      }
      totalWeight += 15
    }

    // 4. Dividend Yield (Weight: 10%)
    const dividendYield = ratios['DIVIDEND_YIELD']?.value
    if (dividendYield !== undefined && dividendYield !== null) {
      const divPercent = dividendYield * 100
      if (divPercent > 5) {
        bullishScore += 10
        reasons.push(`✅ Cổ tức cao (${divPercent.toFixed(2)}%) - Thu nhập ổn định`)
      } else if (divPercent >= 3 && divPercent <= 5) {
        bullishScore += 6
        reasons.push(`✅ Cổ tức tốt (${divPercent.toFixed(2)}%)`)
      } else if (divPercent > 0 && divPercent < 3) {
        reasons.push(`⚠️ Cổ tức thấp (${divPercent.toFixed(2)}%)`)
      } else {
        reasons.push(`⚠️ Không trả cổ tức`)
      }
      totalWeight += 10
    }

    // 5. Market Cap & Liquidity (Weight: 7%)
    const marketCap = ratios['MARKETCAP']?.value
    const freeFloat = ratios['FREEFLOAT']?.value

    if (marketCap !== undefined && marketCap !== null) {
      if (marketCap > 10000000000000) { // > 10 nghìn tỷ
        bullishScore += 5
        reasons.push(`✅ Vốn hóa lớn (${(marketCap / 1000000000000).toFixed(2)} nghìn tỷ) - Cổ phiếu Blue-chip`)
      } else if (marketCap > 1000000000000) { // > 1 nghìn tỷ
        bullishScore += 2
        reasons.push(`✅ Vốn hóa vừa (${(marketCap / 1000000000000).toFixed(2)} nghìn tỷ)`)
      } else {
        reasons.push(`⚠️ Vốn hóa nhỏ (${(marketCap / 1000000000000).toFixed(2)} nghìn tỷ) - Rủi ro cao hơn`)
      }
      totalWeight += 4
    }

    if (freeFloat !== undefined && freeFloat !== null) {
      const ffPercent = freeFloat * 100
      if (ffPercent > 30) {
        bullishScore += 3
        reasons.push(`✅ Free float cao (${ffPercent.toFixed(2)}%) - Thanh khoản tốt`)
      } else if (ffPercent < 15) {
        bearishScore += 3
        reasons.push(`⚠️ Free float thấp (${ffPercent.toFixed(2)}%) - Thanh khoản hạn chế`)
      }
      totalWeight += 3
    }

    // ============ TECHNICAL ANALYSIS: 20% ============

    const closePrices = priceData.map(d => d.adClose)
    const currentPrice = closePrices[closePrices.length - 1]

    // 6. Long-term Trend (MA50 vs MA100) (Weight: 8%)
    if (priceData.length >= 100) {
      const ma50 = calculateSMA(closePrices, 50)
      const ma100 = calculateSMA(closePrices, 100)
      const currentMA50 = ma50[ma50.length - 1]
      const currentMA100 = ma100[ma100.length - 1]

      if (!isNaN(currentMA50) && !isNaN(currentMA100)) {
        const maDiff = ((currentMA50 - currentMA100) / currentMA100) * 100

        if (currentMA50 > currentMA100) {
          if (maDiff > 3) {
            bullishScore += 8
            reasons.push(`✅ MA50 > MA100 (${maDiff.toFixed(2)}%) - Xu hướng dài hạn tăng mạnh`)
          } else {
            bullishScore += 5
            reasons.push(`✅ MA50 > MA100 (${maDiff.toFixed(2)}%) - Xu hướng dài hạn tăng`)
          }
        } else {
          if (maDiff < -3) {
            bearishScore += 8
            reasons.push(`❌ MA50 < MA100 (${maDiff.toFixed(2)}%) - Xu hướng dài hạn giảm mạnh`)
          } else {
            bearishScore += 5
            reasons.push(`❌ MA50 < MA100 (${maDiff.toFixed(2)}%) - Xu hướng dài hạn giảm`)
          }
        }
        totalWeight += 8
      }
    }

    // 7. Long-term Momentum (30 days) (Weight: 7%)
    if (priceData.length >= 30) {
      const priceChange30D = ((currentPrice - closePrices[closePrices.length - 31]) / closePrices[closePrices.length - 31]) * 100

      if (priceChange30D > 10) {
        bullishScore += 7
        reasons.push(`✅ Tăng mạnh 30 ngày (+${priceChange30D.toFixed(2)}%)`)
      } else if (priceChange30D > 5) {
        bullishScore += 4
        reasons.push(`✅ Tăng 30 ngày (+${priceChange30D.toFixed(2)}%)`)
      } else if (priceChange30D < -10) {
        bearishScore += 7
        reasons.push(`❌ Giảm mạnh 30 ngày (${priceChange30D.toFixed(2)}%)`)
      } else if (priceChange30D < -5) {
        bearishScore += 4
        reasons.push(`❌ Giảm 30 ngày (${priceChange30D.toFixed(2)}%)`)
      }
      totalWeight += 7
    }

    // 8. 52-Week Position (Weight: 5%)
    const high52W = Math.max(...closePrices)
    const low52W = Math.min(...closePrices)
    const pricePosition = (currentPrice - low52W) / (high52W - low52W)

    if (pricePosition < 0.3) {
      bullishScore += 5
      reasons.push(`✅ Giá gần đáy 52 tuần (${(pricePosition * 100).toFixed(0)}%) - Tiềm năng tăng`)
    } else if (pricePosition > 0.7) {
      bearishScore += 5
      reasons.push(`❌ Giá gần đỉnh 52 tuần (${(pricePosition * 100).toFixed(0)}%) - Tiềm năng hạn chế`)
    }
    totalWeight += 5

    // ============ ANALYST RECOMMENDATIONS: 10% ============

    if (recommendations && recommendations.length > 0) {
      const buyCount = recommendations.filter(r => r.type === 'BUY').length
      const holdCount = recommendations.filter(r => r.type === 'HOLD').length
      const sellCount = recommendations.filter(r => r.type === 'SELL').length
      const total = recommendations.length

      const buyPercent = (buyCount / total) * 100
      const sellPercent = (sellCount / total) * 100

      // Average target price vs current price
      const avgTargetPrice = recommendations.length > 0 ? recommendations[0].avgTargetPrice : undefined

      if (avgTargetPrice && currentPrice) {
        const upside = ((avgTargetPrice - currentPrice) / currentPrice) * 100

        if (buyPercent >= 60) {
          bullishScore += 10
          reasons.push(`✅ ${buyCount}/${total} CTCK khuyến nghị MUA (${buyPercent.toFixed(0)}%) - Giá MT TB: ${avgTargetPrice.toFixed(0)} (+${upside.toFixed(1)}%)`)
        } else if (buyPercent >= 40) {
          bullishScore += 6
          reasons.push(`✅ ${buyCount}/${total} CTCK khuyến nghị MUA (${buyPercent.toFixed(0)}%) - Giá MT TB: ${avgTargetPrice.toFixed(0)} (+${upside.toFixed(1)}%)`)
        } else if (sellPercent >= 40) {
          bearishScore += 8
          reasons.push(`❌ ${sellCount}/${total} CTCK khuyến nghị BÁN (${sellPercent.toFixed(0)}%)`)
        } else {
          reasons.push(`⚠️ ${total} CTCK: ${buyCount} MUA, ${holdCount} GIỮ, ${sellCount} BÁN - Giá MT TB: ${avgTargetPrice.toFixed(0)}`)
        }
      } else {
        if (buyPercent >= 60) {
          bullishScore += 10
          reasons.push(`✅ ${buyCount}/${total} CTCK khuyến nghị MUA (${buyPercent.toFixed(0)}%)`)
        } else if (buyPercent >= 40) {
          bullishScore += 6
          reasons.push(`✅ ${buyCount}/${total} CTCK khuyến nghị MUA (${buyPercent.toFixed(0)}%)`)
        } else if (sellPercent >= 40) {
          bearishScore += 8
          reasons.push(`❌ ${sellCount}/${total} CTCK khuyến nghị BÁN (${sellPercent.toFixed(0)}%)`)
        } else {
          reasons.push(`⚠️ ${total} CTCK: ${buyCount} MUA, ${holdCount} GIỮ, ${sellCount} BÁN`)
        }
      }

      totalWeight += 10
    } else {
      reasons.push(`⚠️ Chưa có đánh giá từ các CTCK`)
    }

    // If not enough data, add warning
    if (totalWeight < 50) {
      reasons.push(`⚠️ Thiếu dữ liệu để đánh giá đầy đủ`)
    }

    // Calculate final signal and confidence
    const netScore = bullishScore - bearishScore
    const confidence = totalWeight > 50 ? Math.min(Math.abs(netScore), 100) : Math.min(Math.abs(netScore) * 0.7, 70)

    let signal: Signal
    if (netScore > 15) {
      signal = 'MUA'
    } else if (netScore < -15) {
      signal = 'BÁN'
    } else {
      signal = 'NẮM GIỮ'
    }

    return { signal, confidence, reasons }
  }

  const getSignalColor = (signal: Signal) => {
    switch (signal) {
      case 'MUA':
        return 'bg-green-600 text-white'
      case 'BÁN':
        return 'bg-red-600 text-white'
      case 'NẮM GIỮ':
        return 'bg-yellow-600 text-white'
      default:
        return 'bg-gray-600 text-white'
    }
  }

  const getSignalIcon = (signal: Signal) => {
    switch (signal) {
      case 'MUA':
        return '📈'
      case 'BÁN':
        return '📉'
      case 'NẮM GIỮ':
        return '⏸️'
      default:
        return '❓'
    }
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-60">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang phân tích AI...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          🤖 AI Đánh giá - {symbol}
        </h3>
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        🤖 AI Đánh giá - {symbol}
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Short-term Analysis */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 rounded-lg p-5 border border-cyan-700/30">
          <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            ⚡ Ngắn hạn (1-4 tuần)
          </h4>

          <div className="space-y-4">
            {/* Signal Badge */}
            <div className="flex items-center justify-between">
              <div className={`px-6 py-3 rounded-lg font-bold text-lg ${getSignalColor(analysis.shortTerm.signal)}`}>
                {getSignalIcon(analysis.shortTerm.signal)} {analysis.shortTerm.signal}
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-sm">Độ tin cậy</div>
                <div className="text-2xl font-bold text-white">{analysis.shortTerm.confidence}%</div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  analysis.shortTerm.signal === 'MUA'
                    ? 'bg-green-600'
                    : analysis.shortTerm.signal === 'BÁN'
                    ? 'bg-red-600'
                    : 'bg-yellow-600'
                }`}
                style={{ width: `${analysis.shortTerm.confidence}%` }}
              ></div>
            </div>

            {/* Reasons */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-300 mb-2">Phân tích kỹ thuật:</div>
              {analysis.shortTerm.reasons.map((reason, idx) => (
                <div key={idx} className="text-sm text-gray-300 pl-2 border-l-2 border-cyan-500/30">
                  {reason}
                </div>
              ))}
            </div>

            {/* Buy Recommendations - Only show for BUY signal */}
            {analysis.shortTerm.signal === 'MUA' && analysis.shortTerm.buyPrice && (
              <div className="mt-4 pt-4 border-t border-cyan-700/30">
                <div className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                  💰 Khuyến nghị giá mua
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {/* Current Price */}
                  <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/30">
                    <div className="text-xs text-gray-400 mb-1">Giá hiện tại</div>
                    <div className="text-lg font-bold text-white">
                      {analysis.shortTerm.currentPrice?.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Buy Price (Buy T+) */}
                  <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/30">
                    <div className="text-xs text-gray-400 mb-1">Vùng mua đề xuất (Buy T+)</div>
                    <div className="text-lg font-bold text-green-400">
                      {analysis.shortTerm.buyPrice.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {analysis.shortTerm.currentPrice && analysis.shortTerm.buyPrice < analysis.shortTerm.currentPrice
                        ? `Giá tốt hơn ${(((analysis.shortTerm.currentPrice - analysis.shortTerm.buyPrice) / analysis.shortTerm.currentPrice) * 100).toFixed(2)}%`
                        : 'Mức hỗ trợ kỹ thuật'}
                    </div>
                  </div>

                  {/* Cut Loss Price */}
                  <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/30">
                    <div className="text-xs text-gray-400 mb-1">Giá cắt lỗ đề xuất (-3.5%)</div>
                    <div className="text-lg font-bold text-red-400">
                      {analysis.shortTerm.cutLossPrice?.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-yellow-400 mt-1">
                      ⚠️ Thoát vị thế nếu giá phá vỡ mức này
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Long-term Analysis */}
        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg p-5 border border-purple-700/30">
          <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            🎯 Dài hạn (3-12 tháng)
          </h4>

          <div className="space-y-4">
            {/* Signal Badge */}
            <div className="flex items-center justify-between">
              <div className={`px-6 py-3 rounded-lg font-bold text-lg ${getSignalColor(analysis.longTerm.signal)}`}>
                {getSignalIcon(analysis.longTerm.signal)} {analysis.longTerm.signal}
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-sm">Độ tin cậy</div>
                <div className="text-2xl font-bold text-white">{analysis.longTerm.confidence}%</div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  analysis.longTerm.signal === 'MUA'
                    ? 'bg-green-600'
                    : analysis.longTerm.signal === 'BÁN'
                    ? 'bg-red-600'
                    : 'bg-yellow-600'
                }`}
                style={{ width: `${analysis.longTerm.confidence}%` }}
              ></div>
            </div>

            {/* Reasons */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-gray-300 mb-2">Phân tích cơ bản:</div>
              {analysis.longTerm.reasons.map((reason, idx) => (
                <div key={idx} className="text-sm text-gray-300 pl-2 border-l-2 border-purple-500/30">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
        <p className="text-xs text-yellow-300">
          ⚠️ <strong>Lưu ý:</strong> Đây là đánh giá AI dựa trên thuật toán phân tích kỹ thuật và cơ bản.
          Không phải lời khuyên đầu tư. Nhà đầu tư cần tự nghiên cứu và chịu trách nhiệm với quyết định của mình.
        </p>
      </div>
    </div>
  )
}
