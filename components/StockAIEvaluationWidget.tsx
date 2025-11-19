'use client'

import { useState, useEffect } from 'react'
import { fetchStockPrices, fetchFinancialRatios, calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import type { FinancialRatio } from '@/types/vndirect'

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
  gemini?: GeminiAnalysis
}

interface GeminiAnalysis {
  shortTerm?: {
    signal: string
    confidence: number
    summary: string
  }
  longTerm?: {
    signal: string
    confidence: number
    summary: string
  }
  targetPrice?: string
  stopLoss?: string
  risks?: string[]
  opportunities?: string[]
  rawText?: string
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
  const [geminiLoading, setGeminiLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return

    // Reset analysis when symbol changes
    setAnalysis(null)

    const performAnalysis = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('🤖 Performing AI analysis for:', symbol)

        // Fetch both technical and fundamental data
        // For 52-week analysis, we need at least 270 days (52 weeks * 5 trading days + buffer)
        const [pricesResponse, ratiosResponse] = await Promise.all([
          fetchStockPrices(symbol, 270),
          fetchFinancialRatios(symbol)
        ])

        if (!pricesResponse.data || pricesResponse.data.length === 0) {
          throw new Error('Không có dữ liệu giá')
        }

        // Process technical data
        const validData = pricesResponse.data.filter(item => isValidTradingDate(item.date))
        const sortedData = [...validData].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        // Verify we have correct symbol data
        if (sortedData.length > 0) {
          const firstRecord = sortedData[0]
          const lastRecord = sortedData[sortedData.length - 1]
          console.log('📈 Price data received:', {
            requestedSymbol: symbol,
            receivedSymbol: firstRecord.code || lastRecord.code,
            recordCount: sortedData.length,
            dateRange: `${firstRecord.date} to ${lastRecord.date}`,
            latestPrice: lastRecord.adClose
          })

          // Check for symbol mismatch
          if (firstRecord.code && firstRecord.code.toUpperCase() !== symbol.toUpperCase()) {
            console.error('❌ SYMBOL MISMATCH:', {
              requested: symbol,
              received: firstRecord.code
            })
          }
        }

        // Process fundamental data
        const ratiosMap: Record<string, FinancialRatio> = {}
        ratiosResponse.data.forEach(ratio => {
          ratiosMap[ratio.ratioCode] = ratio
        })

        // Perform analysis
        const aiAnalysis = analyzeStock(sortedData, ratiosMap)
        console.log('✅ AI analysis completed for:', symbol)
        setAnalysis(aiAnalysis)

        // Call Gemini API for enhanced analysis (don't wait, run in background)
        setGeminiLoading(true)
        fetchGeminiAnalysis(symbol, sortedData, ratiosMap, aiAnalysis)
          .then(geminiResult => {
            if (geminiResult) {
              console.log('✅ Gemini analysis completed for:', symbol)
              setAnalysis(prev => prev ? { ...prev, gemini: geminiResult } : prev)
            }
          })
          .catch(err => {
            console.warn('⚠️ Gemini analysis failed, continuing without it:', err)
          })
          .finally(() => {
            setGeminiLoading(false)
          })
      } catch (err) {
        console.error('❌ Error performing AI analysis:', err)
        setError('Không thể phân tích AI cho mã này')
      } finally {
        setLoading(false)
      }
    }

    performAnalysis()
  }, [symbol])

  const fetchGeminiAnalysis = async (
    symbol: string,
    priceData: any[],
    ratios: Record<string, FinancialRatio>,
    baseAnalysis: AIAnalysis
  ): Promise<GeminiAnalysis | null> => {
    try {
      // Validate input data
      if (!priceData || priceData.length < 30) {
        console.warn('Insufficient price data for Gemini analysis')
        return null
      }

      const closePrices = priceData.map(d => d.adClose)
      const currentPrice = closePrices[closePrices.length - 1]

      if (!currentPrice || isNaN(currentPrice)) {
        console.warn('Invalid current price for Gemini analysis')
        return null
      }

      const volumes = priceData.map(d => d.nmVolume)

      // Prepare technical data
      const ma10 = calculateSMA(closePrices, 10)
      const ma30 = calculateSMA(closePrices, 30)
      const bb = calculateBollingerBands(closePrices, 20, 2)

      const latestIdx = closePrices.length - 1
      const avgVolume10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
      const currentVolume = volumes[volumes.length - 1]

      const priceChange5D = ((currentPrice - closePrices[closePrices.length - 6]) / closePrices[closePrices.length - 6]) * 100
      const priceChange10D = ((currentPrice - closePrices[closePrices.length - 11]) / closePrices[closePrices.length - 11]) * 100

      const high52W = Math.max(...closePrices)
      const low52W = Math.min(...closePrices)

      const technicalData = {
        currentPrice,
        ma10: ma10[latestIdx],
        ma30: ma30[latestIdx],
        bollinger: {
          upper: bb.upper[latestIdx],
          middle: bb.middle[latestIdx],
          lower: bb.lower[latestIdx]
        },
        momentum: {
          day5: priceChange5D,
          day10: priceChange10D
        },
        volume: {
          current: currentVolume,
          avg10: avgVolume10,
          ratio: (currentVolume / avgVolume10) * 100
        },
        week52: {
          high: high52W,
          low: low52W
        },
        buyPrice: baseAnalysis.shortTerm.buyPrice
      }

      // Prepare fundamental data
      const fundamentalData = {
        pe: ratios['PRICE_TO_EARNINGS']?.value,
        pb: ratios['PRICE_TO_BOOK']?.value,
        roe: ratios['ROAE_TR_AVG5Q']?.value,
        roa: ratios['ROAA_TR_AVG5Q']?.value,
        dividendYield: ratios['DIVIDEND_YIELD']?.value,
        marketCap: ratios['MARKETCAP']?.value,
        freeFloat: ratios['FREEFLOAT']?.value,
        eps: ratios['EPS_TR']?.value,
        bvps: ratios['BVPS_CR']?.value
      }

      // Call Gemini API with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      try {
        const response = await fetch('/api/gemini/stock-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            symbol,
            technicalData,
            fundamentalData
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Gemini API error: ${response.status}`)
        }

        const data = await response.json()

        // Validate response structure
        if (!data || (!data.shortTerm && !data.longTerm)) {
          console.warn('Invalid Gemini response structure')
          return null
        }

        return data as GeminiAnalysis
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          console.warn('Gemini API request timed out after 30 seconds')
          return null
        }
        throw fetchError
      }
    } catch (error) {
      console.error('Error fetching Gemini analysis:', error)
      return null
    }
  }

  const analyzeStock = (priceData: any[], ratios: Record<string, FinancialRatio>): AIAnalysis => {
    // Technical Analysis for Short-term
    const shortTerm = analyzeShortTerm(priceData)

    // Fundamental Analysis for Long-term
    const longTerm = analyzeLongTerm(priceData, ratios)

    return { shortTerm, longTerm }
  }

  const analyzeShortTerm = (priceData: any[]): Evaluation => {
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

    // 1. Moving Averages Analysis (Weight: 30%)
    const ma10 = calculateSMA(closePrices, 10)
    const ma30 = calculateSMA(closePrices, 30)
    const currentMA10 = ma10[ma10.length - 1]
    const currentMA30 = ma30[ma30.length - 1]

    if (!isNaN(currentMA10) && !isNaN(currentMA30)) {
      const maDiff = ((currentMA10 - currentMA30) / currentMA30) * 100

      if (currentMA10 > currentMA30) {
        if (maDiff > 2) {
          bullishScore += 30
          reasons.push(`✅ MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng tăng mạnh`)
        } else {
          bullishScore += 20
          reasons.push(`✅ MA10 > MA30 (${maDiff.toFixed(2)}%) - Xu hướng tăng nhẹ`)
        }
      } else {
        if (maDiff < -2) {
          bearishScore += 30
          reasons.push(`❌ MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng giảm mạnh`)
        } else {
          bearishScore += 20
          reasons.push(`❌ MA10 < MA30 (${maDiff.toFixed(2)}%) - Xu hướng giảm nhẹ`)
        }
      }
      totalWeight += 30
    }

    // 2. Bollinger Bands Analysis (Weight: 25%)
    const bb = calculateBollingerBands(closePrices, 20, 2)
    const currentBBUpper = bb.upper[bb.upper.length - 1]
    const currentBBLower = bb.lower[bb.lower.length - 1]

    if (!isNaN(currentBBUpper) && !isNaN(currentBBLower)) {
      const bandPosition = (currentPrice - currentBBLower) / (currentBBUpper - currentBBLower)

      if (bandPosition <= 0.2) {
        bullishScore += 25
        reasons.push(`✅ Giá gần sát Lower Band (${(bandPosition * 100).toFixed(1)}%) - Vùng mua`)
      } else if (bandPosition >= 0.8) {
        bearishScore += 25
        reasons.push(`❌ Giá gần sát Upper Band (${(bandPosition * 100).toFixed(1)}%) - Vùng bán`)
      } else if (bandPosition < 0.4) {
        bullishScore += 15
        reasons.push(`✅ Giá ở vùng hỗ trợ (${(bandPosition * 100).toFixed(1)}%)`)
      } else if (bandPosition > 0.6) {
        bearishScore += 15
        reasons.push(`❌ Giá ở vùng kháng cự (${(bandPosition * 100).toFixed(1)}%)`)
      }
      totalWeight += 25
    }

    // 3. Price Momentum (Weight: 20%)
    const priceChange5D = ((currentPrice - closePrices[closePrices.length - 6]) / closePrices[closePrices.length - 6]) * 100
    const priceChange10D = ((currentPrice - closePrices[closePrices.length - 11]) / closePrices[closePrices.length - 11]) * 100

    if (priceChange5D > 3 && priceChange10D > 5) {
      bullishScore += 20
      reasons.push(`✅ Tăng mạnh 5 ngày (+${priceChange5D.toFixed(2)}%) và 10 ngày (+${priceChange10D.toFixed(2)}%)`)
    } else if (priceChange5D < -3 && priceChange10D < -5) {
      bearishScore += 20
      reasons.push(`❌ Giảm mạnh 5 ngày (${priceChange5D.toFixed(2)}%) và 10 ngày (${priceChange10D.toFixed(2)}%)`)
    } else if (priceChange5D > 0) {
      bullishScore += 10
      reasons.push(`✅ Tăng nhẹ 5 ngày (+${priceChange5D.toFixed(2)}%)`)
    } else if (priceChange5D < 0) {
      bearishScore += 10
      reasons.push(`❌ Giảm nhẹ 5 ngày (${priceChange5D.toFixed(2)}%)`)
    }
    totalWeight += 20

    // 4. Volume Analysis (Weight: 15%)
    const avgVolume10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    const currentVolume = volumes[volumes.length - 1]
    const volumeRatio = currentVolume / avgVolume10

    if (volumeRatio > 1.5 && priceChange5D > 0) {
      bullishScore += 15
      reasons.push(`✅ Khối lượng tăng mạnh (${(volumeRatio * 100).toFixed(0)}% TB) với giá tăng`)
    } else if (volumeRatio > 1.5 && priceChange5D < 0) {
      bearishScore += 15
      reasons.push(`❌ Khối lượng tăng mạnh (${(volumeRatio * 100).toFixed(0)}% TB) với giá giảm`)
    } else if (volumeRatio < 0.7) {
      reasons.push(`⚠️ Khối lượng thấp (${(volumeRatio * 100).toFixed(0)}% TB)`)
    }
    totalWeight += 15

    // 5. 52-Week High/Low (Weight: 10%)
    const high52W = Math.max(...closePrices)
    const low52W = Math.min(...closePrices)
    const pricePosition = (currentPrice - low52W) / (high52W - low52W)

    if (pricePosition < 0.3) {
      bullishScore += 10
      reasons.push(`✅ Giá gần đáy 52 tuần (${(pricePosition * 100).toFixed(0)}%)`)
    } else if (pricePosition > 0.7) {
      bearishScore += 10
      reasons.push(`❌ Giá gần đỉnh 52 tuần (${(pricePosition * 100).toFixed(0)}%)`)
    }
    totalWeight += 10

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
      // Use the most recent trading day (last element) for pivot calculation
      // This ensures we use the latest completed trading session
      const latestDay = priceData[priceData.length - 1]

      console.log('📊 Calculating pivot points:', {
        symbol: latestDay.code || 'unknown',
        date: latestDay.date,
        high: latestDay.adHigh,
        low: latestDay.adLow,
        close: latestDay.adClose,
        currentPrice: currentPrice
      })

      const pivots = calculateWoodiePivotPoints(latestDay.adHigh, latestDay.adLow, latestDay.adClose)
      // Check if pivots is valid before accessing S2
      if (pivots) {
        buyPrice = pivots.S2 // Buy T+ is S2 support level
        console.log('✅ Pivot points calculated:', { S2: pivots.S2, S1: pivots.S1, pivot: pivots.pivot })
      } else {
        console.warn('⚠️ Pivot points calculation returned null')
      }
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

  const analyzeLongTerm = (priceData: any[], ratios: Record<string, FinancialRatio>): Evaluation => {
    const reasons: string[] = []
    let bullishScore = 0
    let bearishScore = 0
    let totalWeight = 0

    // 1. P/E Ratio Analysis (Weight: 25%)
    const pe = ratios['PRICE_TO_EARNINGS']?.value
    if (pe !== undefined && pe !== null) {
      if (pe > 0 && pe < 10) {
        bullishScore += 25
        reasons.push(`✅ P/E thấp (${pe.toFixed(2)}) - Định giá hấp dẫn`)
      } else if (pe >= 10 && pe <= 20) {
        bullishScore += 15
        reasons.push(`✅ P/E hợp lý (${pe.toFixed(2)})`)
      } else if (pe > 20 && pe <= 30) {
        bearishScore += 10
        reasons.push(`⚠️ P/E cao (${pe.toFixed(2)}) - Cần thận trọng`)
      } else if (pe > 30) {
        bearishScore += 25
        reasons.push(`❌ P/E rất cao (${pe.toFixed(2)}) - Định giá cao`)
      } else if (pe < 0) {
        bearishScore += 20
        reasons.push(`❌ P/E âm (${pe.toFixed(2)}) - Công ty lỗ`)
      }
      totalWeight += 25
    }

    // 2. P/B Ratio Analysis (Weight: 20%)
    const pb = ratios['PRICE_TO_BOOK']?.value
    if (pb !== undefined && pb !== null) {
      if (pb < 1) {
        bullishScore += 20
        reasons.push(`✅ P/B < 1 (${pb.toFixed(2)}) - Giá thấp hơn giá trị sổ sách`)
      } else if (pb >= 1 && pb <= 2) {
        bullishScore += 10
        reasons.push(`✅ P/B hợp lý (${pb.toFixed(2)})`)
      } else if (pb > 2 && pb <= 3) {
        bearishScore += 5
        reasons.push(`⚠️ P/B cao (${pb.toFixed(2)})`)
      } else if (pb > 3) {
        bearishScore += 20
        reasons.push(`❌ P/B rất cao (${pb.toFixed(2)}) - Định giá cao so với tài sản`)
      }
      totalWeight += 20
    }

    // 3. ROE Analysis (Weight: 25%)
    const roe = ratios['ROAE_TR_AVG5Q']?.value
    if (roe !== undefined && roe !== null) {
      const roePercent = roe * 100
      if (roePercent > 20) {
        bullishScore += 25
        reasons.push(`✅ ROE cao (${roePercent.toFixed(2)}%) - Hiệu quả sử dụng vốn tốt`)
      } else if (roePercent >= 15 && roePercent <= 20) {
        bullishScore += 15
        reasons.push(`✅ ROE tốt (${roePercent.toFixed(2)}%)`)
      } else if (roePercent >= 10 && roePercent < 15) {
        bullishScore += 5
        reasons.push(`⚠️ ROE trung bình (${roePercent.toFixed(2)}%)`)
      } else if (roePercent < 10 && roePercent > 0) {
        bearishScore += 10
        reasons.push(`❌ ROE thấp (${roePercent.toFixed(2)}%)`)
      } else {
        bearishScore += 25
        reasons.push(`❌ ROE âm (${roePercent.toFixed(2)}%) - Công ty lỗ`)
      }
      totalWeight += 25
    }

    // 4. Dividend Yield (Weight: 15%)
    const dividendYield = ratios['DIVIDEND_YIELD']?.value
    if (dividendYield !== undefined && dividendYield !== null) {
      const divPercent = dividendYield * 100
      if (divPercent > 5) {
        bullishScore += 15
        reasons.push(`✅ Cổ tức cao (${divPercent.toFixed(2)}%) - Thu nhập ổn định`)
      } else if (divPercent >= 3 && divPercent <= 5) {
        bullishScore += 10
        reasons.push(`✅ Cổ tức tốt (${divPercent.toFixed(2)}%)`)
      } else if (divPercent > 0 && divPercent < 3) {
        reasons.push(`⚠️ Cổ tức thấp (${divPercent.toFixed(2)}%)`)
      } else {
        reasons.push(`⚠️ Không trả cổ tức`)
      }
      totalWeight += 15
    }

    // 5. Market Cap & Liquidity (Weight: 15%)
    const marketCap = ratios['MARKETCAP']?.value
    const freeFloat = ratios['FREEFLOAT']?.value

    if (marketCap !== undefined && marketCap !== null) {
      if (marketCap > 10000000000000) { // > 10 nghìn tỷ
        bullishScore += 10
        reasons.push(`✅ Vốn hóa lớn (${(marketCap / 1000000000000).toFixed(2)} nghìn tỷ) - Cổ phiếu Blue-chip`)
      } else if (marketCap > 1000000000000) { // > 1 nghìn tỷ
        bullishScore += 5
        reasons.push(`✅ Vốn hóa vừa (${(marketCap / 1000000000000).toFixed(2)} nghìn tỷ)`)
      } else {
        reasons.push(`⚠️ Vốn hóa nhỏ (${(marketCap / 1000000000000).toFixed(2)} nghìn tỷ) - Rủi ro cao hơn`)
      }
      totalWeight += 10
    }

    if (freeFloat !== undefined && freeFloat !== null) {
      const ffPercent = freeFloat * 100
      if (ffPercent > 30) {
        bullishScore += 5
        reasons.push(`✅ Free float cao (${ffPercent.toFixed(2)}%) - Thanh khoản tốt`)
      } else if (ffPercent < 15) {
        bearishScore += 5
        reasons.push(`⚠️ Free float thấp (${ffPercent.toFixed(2)}%) - Thanh khoản hạn chế`)
      }
      totalWeight += 5
    }

    // If not enough fundamental data, add warning
    if (totalWeight < 50) {
      reasons.push(`⚠️ Thiếu dữ liệu cơ bản để đánh giá đầy đủ`)
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
                      {analysis.shortTerm.currentPrice?.toLocaleString('vi-VN')} VNĐ
                    </div>
                  </div>

                  {/* Buy Price (Buy T+) */}
                  <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/30">
                    <div className="text-xs text-gray-400 mb-1">Vùng mua đề xuất (Buy T+)</div>
                    <div className="text-lg font-bold text-green-400">
                      {analysis.shortTerm.buyPrice.toLocaleString('vi-VN')} VNĐ
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
                      {analysis.shortTerm.cutLossPrice?.toLocaleString('vi-VN')} VNĐ
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

      {/* Gemini AI Analysis */}
      {(geminiLoading || analysis.gemini) && (
        <div className="mt-6 bg-gradient-to-br from-indigo-900/20 to-violet-900/20 rounded-lg p-5 border border-indigo-700/30">
          <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            🤖 Gemini AI - Phân tích chuyên sâu
            {geminiLoading && (
              <span className="text-sm text-gray-400 font-normal flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                Đang phân tích...
              </span>
            )}
          </h4>

          {geminiLoading && !analysis.gemini && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-400 text-sm">AI đang phân tích dữ liệu kỹ thuật và cơ bản...</p>
              </div>
            </div>
          )}

          {analysis.gemini && (
            <>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Gemini Short-term */}
            {analysis.gemini.shortTerm && (
              <div className="bg-cyan-900/20 rounded-lg p-4 border border-cyan-700/30">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold text-cyan-300">⚡ Ngắn hạn</h5>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded text-sm font-bold ${
                      analysis.gemini.shortTerm.signal.includes('MUA') ? 'bg-green-600' :
                      analysis.gemini.shortTerm.signal.includes('BÁN') ? 'bg-red-600' : 'bg-yellow-600'
                    }`}>
                      {analysis.gemini.shortTerm.signal}
                    </span>
                    <span className="text-sm text-gray-400">{analysis.gemini.shortTerm.confidence}%</span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{analysis.gemini.shortTerm.summary}</p>
              </div>
            )}

            {/* Gemini Long-term */}
            {analysis.gemini.longTerm && (
              <div className="bg-purple-900/20 rounded-lg p-4 border border-purple-700/30">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold text-purple-300">🎯 Dài hạn</h5>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded text-sm font-bold ${
                      analysis.gemini.longTerm.signal.includes('MUA') ? 'bg-green-600' :
                      analysis.gemini.longTerm.signal.includes('BÁN') ? 'bg-red-600' : 'bg-yellow-600'
                    }`}>
                      {analysis.gemini.longTerm.signal}
                    </span>
                    <span className="text-sm text-gray-400">{analysis.gemini.longTerm.confidence}%</span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{analysis.gemini.longTerm.summary}</p>
              </div>
            )}
          </div>

          {/* Price Targets and Stop Loss */}
          {(analysis.gemini.targetPrice || analysis.gemini.stopLoss) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {analysis.gemini.targetPrice && (
                <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                  <div className="text-xs text-gray-400 mb-1">🎯 Giá mục tiêu</div>
                  <div className="text-lg font-bold text-green-400">{analysis.gemini.targetPrice}</div>
                </div>
              )}
              {analysis.gemini.stopLoss && (
                <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
                  <div className="text-xs text-gray-400 mb-1">🛑 Mức cắt lỗ</div>
                  <div className="text-lg font-bold text-red-400">{analysis.gemini.stopLoss}</div>
                </div>
              )}
            </div>
          )}

          {/* Risks and Opportunities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Risks */}
            {analysis.gemini.risks && analysis.gemini.risks.length > 0 && (
              <div className="bg-red-900/10 rounded-lg p-4 border border-red-700/20">
                <h5 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                  ⚠️ Rủi ro
                </h5>
                <ul className="space-y-1">
                  {analysis.gemini.risks.map((risk, idx) => (
                    <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Opportunities */}
            {analysis.gemini.opportunities && analysis.gemini.opportunities.length > 0 && (
              <div className="bg-green-900/10 rounded-lg p-4 border border-green-700/20">
                <h5 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                  💡 Cơ hội
                </h5>
                <ul className="space-y-1">
                  {analysis.gemini.opportunities.map((opp, idx) => (
                    <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      <span>{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      )}

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
