// File: app/chat/chat-gemini.ts
'use server'

import { geminiAlpha, geminiDeepAnalysis } from '@/lib/gemini'
import { fetchGoldenCrossSignals } from '@/services/signal.service'
import type { DeepAnalysisResult } from '@/lib/gemini/types'

// VNDirect API base URL
const VNDIRECT_API_BASE = 'https://api-finfo.vndirect.com.vn/v4'

// Common HTTP headers for VNDirect API
const VNDIRECT_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://dstock.vndirect.com.vn/',
  'Origin': 'https://dstock.vndirect.com.vn',
}

/**
 * Kiểm tra kết nối Gemini API
 */
export async function checkConnection(): Promise<boolean> {
  return await geminiAlpha.checkConnection()
}

/**
 * Fetch stock prices from VNDirect API (server-side)
 */
async function fetchStockPricesServer(stockCode: string, size: number = 150) {
  try {
    const url = `${VNDIRECT_API_BASE}/stock_prices?sort=date:desc&q=code:${stockCode.toUpperCase()}&size=${size}`
    console.log('📡 [Chat] Fetching stock prices:', stockCode)

    const response = await fetch(url, {
      headers: VNDIRECT_HEADERS,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('❌ VNDirect stock prices error:', response.status)
      return null
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('❌ Error fetching stock prices:', error)
    return null
  }
}

/**
 * Fetch financial ratios from VNDirect API (server-side)
 */
async function fetchFinancialRatiosServer(stockCode: string) {
  try {
    const ratios = [
      'MARKETCAP', 'PRICE_TO_EARNINGS', 'PRICE_TO_BOOK',
      'DIVIDEND_YIELD', 'ROAE_TR_AVG5Q', 'ROAA_TR_AVG5Q',
      'EPS_TR', 'BVPS_CR', 'PRICE_HIGHEST_CR_52W', 'PRICE_LOWEST_CR_52W'
    ]
    const ratiosFilter = ratios.join(',')
    const url = `${VNDIRECT_API_BASE}/ratios/latest?filter=ratioCode:${ratiosFilter}&where=code:${stockCode.toUpperCase()}&order=reportDate&fields=ratioCode,value`

    console.log('📡 [Chat] Fetching financial ratios:', stockCode)

    const response = await fetch(url, {
      headers: VNDIRECT_HEADERS,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('❌ VNDirect ratios error:', response.status)
      return null
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('❌ Error fetching ratios:', error)
    return null
  }
}

/**
 * Fetch analyst recommendations from VNDirect API (server-side)
 */
async function fetchRecommendationsServer(stockCode: string) {
  try {
    const date12MonthsAgo = new Date()
    date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12)
    const dateFilter = date12MonthsAgo.toISOString().split('T')[0]

    const url = `${VNDIRECT_API_BASE}/recommendations?q=code:${stockCode.toUpperCase()}~reportDate:gte:${dateFilter}&size=50&sort=reportDate:DESC`

    console.log('📡 [Chat] Fetching recommendations:', stockCode)

    const response = await fetch(url, {
      headers: VNDIRECT_HEADERS,
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('❌ VNDirect recommendations error:', response.status)
      return null
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('❌ Error fetching recommendations:', error)
    return null
  }
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number | null {
  if (!prices || prices.length < period) return null
  const subset = prices.slice(-period)
  return subset.reduce((a, b) => a + b, 0) / period
}

/**
 * Calculate Standard Deviation
 */
function calculateStdDev(prices: number[], period: number): number {
  if (!prices || prices.length < period) return 0
  const subset = prices.slice(-period)
  const mean = subset.reduce((a, b) => a + b, 0) / period
  const squaredDiffs = subset.map(val => Math.pow(val - mean, 2))
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period
  return Math.sqrt(variance)
}

/**
 * Calculate Bollinger Bands
 */
function calculateBollingerBands(prices: number[], period: number = 20, stdDevMultiplier: number = 2) {
  const middle = calculateSMA(prices, period)
  if (middle === null) return null

  const stdDev = calculateStdDev(prices, period)
  return {
    upper: middle + stdDevMultiplier * stdDev,
    middle,
    lower: middle - stdDevMultiplier * stdDev
  }
}

/**
 * Prepare technical data for Deep Analysis
 */
function prepareTechnicalData(priceData: any[]) {
  if (!priceData || priceData.length === 0) return null

  // Sort by date ascending (oldest first)
  const sortedData = [...priceData].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  const closePrices = sortedData.map(d => Number(d.close) || 0)
  const volumes = sortedData.map(d => Number(d.nmVolume) || 0)
  const latest = sortedData[sortedData.length - 1]

  // Calculate indicators
  const ma10 = calculateSMA(closePrices, 10)
  const ma30 = calculateSMA(closePrices, 30)
  const bollinger = calculateBollingerBands(closePrices, 20, 2)

  // Calculate momentum
  const currentPrice = closePrices[closePrices.length - 1]
  const price5dAgo = closePrices.length > 5 ? closePrices[closePrices.length - 6] : null
  const price10dAgo = closePrices.length > 10 ? closePrices[closePrices.length - 11] : null

  const momentum5d = price5dAgo ? ((currentPrice - price5dAgo) / price5dAgo) * 100 : null
  const momentum10d = price10dAgo ? ((currentPrice - price10dAgo) / price10dAgo) * 100 : null

  // Calculate average volume
  const avgVolume10 = volumes.length >= 10
    ? volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
    : null

  // Find 52-week high/low
  const last52wPrices = closePrices.slice(-252)
  const week52High = last52wPrices.length > 0 ? Math.max(...last52wPrices) : null
  const week52Low = last52wPrices.length > 0 ? Math.min(...last52wPrices) : null

  return {
    currentPrice,
    ma10,
    ma30,
    bollinger,
    momentum: {
      day5: momentum5d,
      day10: momentum10d
    },
    volume: {
      current: volumes[volumes.length - 1],
      avg10: avgVolume10,
      ratio: avgVolume10 ? (volumes[volumes.length - 1] / avgVolume10) * 100 : null
    },
    week52: {
      high: week52High,
      low: week52Low
    },
    buyPrice: bollinger?.lower || null
  }
}

/**
 * Prepare fundamental data for Deep Analysis
 */
function prepareFundamentalData(ratiosData: any[]) {
  if (!ratiosData || ratiosData.length === 0) return null

  const ratiosMap: Record<string, number> = {}
  ratiosData.forEach(r => {
    if (r.ratioCode && r.value !== undefined) {
      let value = Number(r.value) || 0
      // VNDirect returns some values in thousands
      if (['PRICE_HIGHEST_CR_52W', 'PRICE_LOWEST_CR_52W', 'BVPS_CR', 'EPS_TR'].includes(r.ratioCode)) {
        value = value / 1000
      }
      ratiosMap[r.ratioCode] = value
    }
  })

  return {
    pe: ratiosMap['PRICE_TO_EARNINGS'],
    pb: ratiosMap['PRICE_TO_BOOK'],
    roe: ratiosMap['ROAE_TR_AVG5Q'],
    roa: ratiosMap['ROAA_TR_AVG5Q'],
    dividendYield: ratiosMap['DIVIDEND_YIELD'],
    marketCap: ratiosMap['MARKETCAP'],
    eps: ratiosMap['EPS_TR']
  }
}

/**
 * Prepare recommendations data for Deep Analysis
 */
function prepareRecommendations(recsData: any[]) {
  if (!recsData || recsData.length === 0) return []

  return recsData.map(r => ({
    type: r.type || '',
    targetPrice: r.targetPrice ? Number(r.targetPrice) / 1000 : undefined,
    firm: r.firm || '',
    reportDate: r.reportDate || ''
  }))
}

/**
 * Perform stock analysis using Deep Analysis
 */
async function performStockAnalysis(symbol: string): Promise<{
  analysis: DeepAnalysisResult | null
  error?: string
}> {
  console.log('🔍 [Chat] Starting stock analysis for:', symbol)

  try {
    // Fetch all data in parallel
    const [priceData, ratiosData, recsData] = await Promise.all([
      fetchStockPricesServer(symbol, 270),
      fetchFinancialRatiosServer(symbol),
      fetchRecommendationsServer(symbol)
    ])

    if (!priceData || priceData.length === 0) {
      return { analysis: null, error: `Không tìm thấy dữ liệu cổ phiếu ${symbol}` }
    }

    // Prepare data for Deep Analysis
    const technicalData = prepareTechnicalData(priceData)
    const fundamentalData = prepareFundamentalData(ratiosData)
    const recommendations = prepareRecommendations(recsData)

    if (!technicalData) {
      return { analysis: null, error: `Không thể phân tích kỹ thuật ${symbol}` }
    }

    console.log('📊 [Chat] Technical data prepared:', {
      currentPrice: technicalData.currentPrice,
      ma10: technicalData.ma10,
      ma30: technicalData.ma30
    })

    // Call Deep Analysis
    const analysis = await geminiDeepAnalysis.analyze({
      symbol,
      technicalData,
      fundamentalData: fundamentalData || undefined,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      model: 'gemini-2.5-flash-lite'
    })

    console.log('✅ [Chat] Analysis completed for:', symbol)
    return { analysis }
  } catch (error: any) {
    console.error('❌ [Chat] Analysis error:', error)
    return { analysis: null, error: error.message || 'Lỗi phân tích cổ phiếu' }
  }
}

/**
 * Chat với Gemini Alpha AI
 * Tự động lấy context tín hiệu thị trường
 * Tự động phát hiện và phân tích cổ phiếu khi user yêu cầu
 */
export async function askGemini(prompt: string) {
  try {
    // Check if this is a stock analysis request
    const stockSymbol = geminiAlpha.detectStockAnalysisRequest(prompt)

    if (stockSymbol) {
      console.log('🔍 [Chat] Detected stock analysis request for:', stockSymbol)

      // Perform stock analysis
      const { analysis, error } = await performStockAnalysis(stockSymbol)

      if (error) {
        return { text: `❌ ${error}` }
      }

      if (analysis) {
        // Format the analysis for chat display
        const formattedAnalysis = geminiAlpha.formatDeepAnalysisForChat(stockSymbol, analysis)
        return { text: formattedAnalysis }
      }

      return { text: `Không thể phân tích cổ phiếu ${stockSymbol}. Vui lòng thử lại.` }
    }

    // Regular chat - get market signals context
    let signalsContext = 'Hiện tại chưa lấy được dữ liệu tín hiệu.'

    try {
      const signals = await fetchGoldenCrossSignals()
      signalsContext = geminiAlpha.formatSignalsContext(signals)
    } catch (err) {
      console.error('Lỗi đọc dữ liệu signals:', err)
      // Nếu lỗi database, bot vẫn hoạt động nhưng không có dữ liệu
    }

    // Gọi Gemini Alpha với context
    return await geminiAlpha.ask(prompt, signalsContext)
  } catch (error: any) {
    console.error('askGemini Error:', error)
    return { error: 'Alpha đang gặp sự cố kết nối.' }
  }
}
