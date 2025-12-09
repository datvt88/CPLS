'use client'

import { useState, useEffect } from 'react'
import { fetchStockPrices, fetchFinancialRatios, fetchStockRecommendations, calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import type { FinancialRatio } from '@/types/vndirect'
import { formatPrice } from '@/utils/formatters'

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
  
  // --- STATE MỚI ĐỂ QUẢN LÝ NÚT BẤM GEMINI ---
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiTriggered, setGeminiTriggered] = useState(false) 

  // Cache dữ liệu để dùng lại khi bấm nút (tránh fetch lại)
  const [cachedData, setCachedData] = useState<{
    sortedData: any[],
    ratiosMap: Record<string, FinancialRatio>,
    recommendations: any[],
    profitabilityResponse: any
  } | null>(null)

  useEffect(() => {
    if (!symbol) return

    // Reset trạng thái khi đổi mã
    setAnalysis(null)
    setGeminiTriggered(false)
    setCachedData(null)
    setGeminiLoading(false)

    const performAnalysis = async () => {
      setLoading(true)
      setError(null)

      try {
        console.log('🤖 Performing Basic Analysis for:', symbol)

        // 1. Chỉ tải dữ liệu cơ bản (Miễn phí)
        const [pricesResponse, ratiosResponse, recommendationsResponse, profitabilityResponse] = await Promise.all([
          fetchStockPrices(symbol, 270),
          fetchFinancialRatios(symbol),
          fetchStockRecommendations(symbol).catch(() => ({ data: [] })),
          fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`)
            .then(res => res.json())
            .catch(() => null)
        ])

        if (!pricesResponse.data || pricesResponse.data.length === 0) {
          throw new Error('Không có dữ liệu giá')
        }

        const validData = pricesResponse.data.filter(item => isValidTradingDate(item.date))
        const sortedData = [...validData].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        const ratiosMap: Record<string, FinancialRatio> = {}
        ratiosResponse.data.forEach(ratio => {
          ratiosMap[ratio.ratioCode] = ratio
        })

        // 2. Lưu dữ liệu vào cache để dành cho nút bấm Gemini
        setCachedData({
          sortedData,
          ratiosMap,
          recommendations: recommendationsResponse.data || [],
          profitabilityResponse
        })

        // 3. Chạy phân tích thuật toán nội bộ (Không tốn tiền API)
        const aiAnalysis = analyzeStock(sortedData, ratiosMap, profitabilityResponse)
        setAnalysis(aiAnalysis)

        // KHÔNG GỌI GEMINI TỰ ĐỘNG Ở ĐÂY NỮA

      } catch (err) {
        console.error('❌ Error performing analysis:', err)
        setError('Không thể phân tích mã này')
      } finally {
        setLoading(false)
      }
    }

    performAnalysis()
  }, [symbol])

  // --- HÀM XỬ LÝ KHI BẤM NÚT GEMINI ---
  const handleGeminiAnalysis = async () => {
    if (!cachedData || !analysis) return

    setGeminiLoading(true)
    setGeminiTriggered(true) // Đánh dấu đã bấm nút

    try {
      console.log('✨ Triggering Gemini Analysis...')
      const geminiResult = await fetchGeminiAnalysis(
        symbol,
        cachedData.sortedData,
        cachedData.ratiosMap,
        cachedData.recommendations,
        analysis,
        cachedData.profitabilityResponse
      )

      if (geminiResult) {
        setAnalysis(prev => prev ? { ...prev, gemini: geminiResult } : prev)
      }
    } catch (err) {
      console.warn('⚠️ Gemini analysis failed:', err)
    } finally {
      setGeminiLoading(false)
    }
  }

  // ... (Logic gọi API Gemini - Giữ nguyên logic cũ)
  const fetchGeminiAnalysis = async (
    symbol: string,
    priceData: any[],
    ratios: Record<string, FinancialRatio>,
    recommendations: any[],
    baseAnalysis: AIAnalysis,
    profitabilityData: any
  ): Promise<GeminiAnalysis | null> => {
    try {
      if (!priceData || priceData.length < 30) return null

      const closePrices = priceData.map(d => d.adClose)
      const currentPrice = closePrices[closePrices.length - 1]
      const volumes = priceData.map(d => d.nmVolume)

      const ma10 = calculateSMA(closePrices, 10)
      const ma30 = calculateSMA(closePrices, 30)
      const bb = calculateBollingerBands(closePrices, 20, 2)
      const latestIdx = closePrices.length - 1
      
      // Calculate basic technicals needed for Gemini context
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
        momentum: { day5: priceChange5D, day10: priceChange10D },
        volume: {
          current: currentVolume,
          avg10: avgVolume10,
          ratio: (currentVolume / avgVolume10) * 100
        },
        week52: { high: high52W, low: low52W },
        buyPrice: baseAnalysis.shortTerm.buyPrice
      }

      const fundamentalData = {
        pe: ratios['PRICE_TO_EARNINGS']?.value,
        pb: ratios['PRICE_TO_BOOK']?.value,
        roe: ratios['ROAE_TR_AVG5Q']?.value,
        roa: ratios['ROAA_TR_AVG5Q']?.value,
        dividendYield: ratios['DIVIDEND_YIELD']?.value,
        marketCap: ratios['MARKETCAP']?.value,
        freeFloat: ratios['FREEFLOAT']?.value,
        eps: ratios['EPS_TR']?.value,
        bvps: ratios['BVPS_CR']?.value,
        profitability: profitabilityData ? {
          quarters: profitabilityData.x || [],
          metrics: profitabilityData.data || []
        } : null
      }

      const recentRecommendations = recommendations
        .slice(0, 10)
        .map(rec => ({
          firm: rec.firm,
          type: rec.type,
          reportDate: rec.reportDate,
          targetPrice: rec.targetPrice,
          reportPrice: rec.reportPrice
        }))

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 45000) // 45s timeout cho AI suy nghĩ

      try {
        const response = await fetch('/api/gemini/stock-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol,
            technicalData,
            fundamentalData,
            recommendations: recentRecommendations
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)
        const data = await response.json()
        return data as GeminiAnalysis

      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        console.warn('Gemini fetch error:', fetchError)
        return null
      }
    } catch (error) {
      console.error('Error preparing Gemini data:', error)
      return null
    }
  }

  // ... (Logic phân tích nội bộ - Giữ nguyên)
  const analyzeStock = (priceData: any[], ratios: Record<string, FinancialRatio>, profitabilityData: any): AIAnalysis => {
    const shortTerm = analyzeShortTerm(priceData)
    const longTerm = analyzeLongTerm(priceData, ratios, profitabilityData)
    return { shortTerm, longTerm }
  }

  const analyzeShortTerm = (priceData: any[]): Evaluation => {
    // ... (Giữ nguyên logic cũ của bạn để tính toán điểm số kỹ thuật)
    // Để tiết kiệm không gian bài viết, tôi giả định bạn giữ nguyên logic tính toán ở đây
    // vì chúng ta chỉ thay đổi cách hiển thị và trigger.
    
    // Copy lại toàn bộ logic calculateShortTerm cũ của bạn vào đây
    // ...
    const closePrices = priceData.map(d => d.adClose)
    const currentPrice = closePrices[closePrices.length - 1]
    const volumes = priceData.map(d => d.nmVolume)
    
    // Simple mock logic to make the code compile if you copy-paste (REPLACE WITH YOUR REAL LOGIC)
    // --- BẮT ĐẦU LOGIC CŨ ---
    const reasons: string[] = []
    let bullishScore = 0
    let bearishScore = 0
    let totalWeight = 0

    const ma10 = calculateSMA(closePrices, 10)
    const ma30 = calculateSMA(closePrices, 30)
    const currentMA10 = ma10[ma10.length - 1]
    const currentMA30 = ma30[ma30.length - 1]

    if (currentMA10 > currentMA30) {
        bullishScore += 30; reasons.push('MA10 > MA30 - Xu hướng tăng')
    } else {
        bearishScore += 30; reasons.push('MA10 < MA30 - Xu hướng giảm')
    }
    totalWeight += 30

    // ... (Thêm các logic Bollinger, Volume, etc từ code cũ của bạn) ...

    const netScore = bullishScore - bearishScore
    const confidence = Math.min(Math.abs(netScore), 100)
    let signal: Signal = netScore > 15 ? 'MUA' : netScore < -15 ? 'BÁN' : 'NẮM GIỮ'
    
    let buyPrice = undefined
    let cutLossPrice = undefined
    
    // Tính Pivot
    if (priceData.length >= 2) {
       const latestDay = priceData[priceData.length - 1]
       const pivots = calculateWoodiePivotPoints(latestDay.adHigh, latestDay.adLow, latestDay.adClose)
       if (pivots) buyPrice = pivots.S2
    }
    if (buyPrice) cutLossPrice = Number((buyPrice * 0.965).toFixed(2))

    return { signal, confidence, reasons, currentPrice, buyPrice, cutLossPrice }
    // --- KẾT THÚC LOGIC CŨ ---
  }

  const analyzeLongTerm = (priceData: any[], ratios: Record<string, FinancialRatio>, profitabilityData: any): Evaluation => {
    // ... (Giữ nguyên logic cũ của bạn để tính toán điểm số cơ bản)
    // REPLACE WITH YOUR REAL LOGIC
    
    // --- BẮT ĐẦU LOGIC CŨ ---
    const reasons: string[] = []
    let bullishScore = 0
    let bearishScore = 0
    
    const pe = ratios['PRICE_TO_EARNINGS']?.value
    if (pe && pe < 15) { bullishScore += 25; reasons.push(`P/E thấp (${pe.toFixed(2)})`) }
    
    const pb = ratios['PRICE_TO_BOOK']?.value
    if (pb && pb < 2) { bullishScore += 20; reasons.push(`P/B hợp lý (${pb.toFixed(2)})`) }

    const netScore = bullishScore - bearishScore
    const confidence = Math.min(Math.abs(netScore), 100)
    let signal: Signal = netScore > 15 ? 'MUA' : netScore < -15 ? 'BÁN' : 'NẮM GIỮ'

    return { signal, confidence, reasons }
    // --- KẾT THÚC LOGIC CŨ ---
  }

  const getSignalColor = (signal: Signal) => {
    switch (signal) {
      case 'MUA': return 'bg-green-600 text-white'
      case 'BÁN': return 'bg-red-600 text-white'
      case 'NẮM GIỮ': return 'bg-yellow-600 text-white'
      default: return 'bg-gray-600 text-white'
    }
  }

  const getSignalIcon = (signal: Signal) => {
    switch (signal) {
      case 'MUA': return '📈'; case 'BÁN': return '📉'; case 'NẮM GIỮ': return '⏸️'; default: return '❓'
    }
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-60">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang phân tích dữ liệu...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">🤖 Tổng Hợp Đánh giá</h3>
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">{error}</div>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="bg-[--panel] rounded-xl p-4 sm:p-6 border border-gray-800">
      <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2 flex-wrap">
        🤖 Tổng hợp đánh giá - {symbol}
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Short-term Analysis - GIỮ NGUYÊN */}
        <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 rounded-lg p-4 sm:p-5 border border-cyan-700/30">
          <h4 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">⚡ Ngắn hạn (1-4 tuần)</h4>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-base sm:text-lg ${getSignalColor(analysis.shortTerm.signal)}`}>
                {getSignalIcon(analysis.shortTerm.signal)} {analysis.shortTerm.signal}
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs sm:text-sm">Độ tin cậy</div>
                <div className="text-xl sm:text-2xl font-bold text-white">{analysis.shortTerm.confidence}%</div>
              </div>
            </div>
            {/* ... Render chi tiết ngắn hạn (Reasons, Prices) giữ nguyên ... */}
             <div className="space-y-2">
               {analysis.shortTerm.reasons.slice(0, 3).map((r, i) => <div key={i} className="text-sm text-gray-300 pl-2 border-l-2 border-cyan-500/30">{r}</div>)}
             </div>
             {/* Simple Price Display for context */}
             {analysis.shortTerm.currentPrice && (
                 <div className="mt-2 text-sm text-gray-400">Giá: {formatPrice(analysis.shortTerm.currentPrice)}</div>
             )}
          </div>
        </div>

        {/* Long-term Analysis - GIỮ NGUYÊN */}
        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg p-4 sm:p-5 border border-purple-700/30">
          <h4 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">🎯 Dài hạn (3-12 tháng)</h4>
          <div className="space-y-3 sm:space-y-4">
             <div className="flex items-center justify-between gap-2">
              <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-base sm:text-lg ${getSignalColor(analysis.longTerm.signal)}`}>
                {getSignalIcon(analysis.longTerm.signal)} {analysis.longTerm.signal}
              </div>
              <div className="text-right">
                <div className="text-gray-400 text-xs sm:text-sm">Độ tin cậy</div>
                <div className="text-xl sm:text-2xl font-bold text-white">{analysis.longTerm.confidence}%</div>
              </div>
            </div>
             <div className="space-y-2">
               {analysis.longTerm.reasons.slice(0, 3).map((r, i) => <div key={i} className="text-sm text-gray-300 pl-2 border-l-2 border-purple-500/30">{r}</div>)}
             </div>
          </div>
        </div>
      </div>

      {/* --- PHẦN GEMINI AI ĐÃ ĐƯỢC CHỈNH SỬA --- */}
      <div className="mt-4 sm:mt-6 bg-gradient-to-br from-indigo-900/20 to-violet-900/20 rounded-lg p-4 sm:p-5 border border-indigo-700/30 transition-all duration-500">
        <h4 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2 flex-wrap">
          🤖 Gemini AI - Phân tích chuyên sâu
        </h4>

        {/* 1. Nút kích hoạt: Chỉ hiện khi chưa bấm */}
        {!geminiTriggered && (
          <div className="text-center py-6">
            <p className="text-gray-300 mb-4 text-sm sm:text-base">
              Kích hoạt AI để nhận phân tích chi tiết về rủi ro, cơ hội và giá mục tiêu từ Gemini.
            </p>
            <button
              onClick={handleGeminiAnalysis}
              className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-200 bg-indigo-600 font-lg rounded-full hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
            >
              <span className="mr-2 text-xl">✨</span>
              Phân tích chuyên sâu với AI
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
            </button>
          </div>
        )}

        {/* 2. Loading: Hiện khi đã bấm và đang tải */}
        {geminiLoading && (
          <div className="flex flex-col items-center justify-center h-48 animate-fade-in">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-indigo-300 font-medium animate-pulse">AI đang đọc báo cáo tài chính & biểu đồ...</p>
            <p className="text-gray-500 text-xs mt-2">(Quá trình này có thể mất 10-20 giây)</p>
          </div>
        )}

        {/* 3. Kết quả: Hiện khi đã có data */}
        {analysis.gemini && !geminiLoading && (
          <div className="animate-fade-in space-y-4">
             {/* Gemini Signals */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {/* Short term */}
                <div className="bg-cyan-900/20 rounded-lg p-3 border border-cyan-700/30">
                   <div className="flex justify-between mb-2">
                      <span className="text-cyan-300 font-bold">⚡ Ngắn hạn</span>
                      <span className="font-bold text-white">{analysis.gemini.shortTerm?.signal}</span>
                   </div>
                   <p className="text-sm text-gray-300">{analysis.gemini.shortTerm?.summary}</p>
                </div>
                {/* Long term */}
                <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-700/30">
                   <div className="flex justify-between mb-2">
                      <span className="text-purple-300 font-bold">🎯 Dài hạn</span>
                      <span className="font-bold text-white">{analysis.gemini.longTerm?.signal}</span>
                   </div>
                   <p className="text-sm text-gray-300">{analysis.gemini.longTerm?.summary}</p>
                </div>
             </div>

             {/* Targets */}
             <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-900/20 p-3 rounded-lg border border-green-700/30 text-center">
                   <div className="text-xs text-gray-400">Giá mục tiêu</div>
                   <div className="text-lg font-bold text-green-400">{analysis.gemini.targetPrice || 'N/A'}</div>
                </div>
                <div className="bg-red-900/20 p-3 rounded-lg border border-red-700/30 text-center">
                   <div className="text-xs text-gray-400">Cắt lỗ</div>
                   <div className="text-lg font-bold text-red-400">{analysis.gemini.stopLoss || 'N/A'}</div>
                </div>
             </div>

             {/* Risks & Opps */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-900/10 p-3 rounded-lg border border-red-700/20">
                   <h5 className="text-red-400 font-bold mb-2 text-sm">⚠️ Rủi ro</h5>
                   <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                      {analysis.gemini.risks?.map((r, i) => <li key={i}>{r}</li>)}
                   </ul>
                </div>
                <div className="bg-green-900/10 p-3 rounded-lg border border-green-700/20">
                   <h5 className="text-green-400 font-bold mb-2 text-sm">💡 Cơ hội</h5>
                   <ul className="list-disc list-inside text-xs text-gray-300 space-y-1">
                      {analysis.gemini.opportunities?.map((o, i) => <li key={i}>{o}</li>)}
                   </ul>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
