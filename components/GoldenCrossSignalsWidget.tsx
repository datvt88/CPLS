'use client'

import { useState, useEffect } from 'react'
import { formatPrice } from '@/utils/formatters'

interface GoldenCrossStock {
  symbol: string
  currentPrice: number
  ma10: number
  ma30: number
  pe?: number
  pb?: number
  roe?: number
  fundamentalScore: number
  fundamentalReasons: string[]
}

interface GeminiAnalysisResult {
  symbol: string
  shortTerm: {
    signal: string
    confidence: number
    summary: string
  }
  longTerm: {
    signal: string
    confidence: number
    summary: string
  }
  targetPrice?: string
  stopLoss?: string
  risks: string[]
  opportunities: string[]
}

interface AnalyzedStock extends GoldenCrossStock {
  geminiAnalysis?: GeminiAnalysisResult
  recommendationAction: 'MUA' | 'THEO DÕI' | 'BỎ QUA'
  isAnalyzing: boolean
  isSaving: boolean
}

export default function GoldenCrossSignalsWidget() {
  const [stocks, setStocks] = useState<AnalyzedStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzingAll, setAnalyzingAll] = useState(false)
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchGoldenCrossStocks()
  }, [])

  const fetchGoldenCrossStocks = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get golden cross stocks from Firebase
      const gcResponse = await fetch('/api/signals/golden-cross')
      if (!gcResponse.ok) {
        throw new Error('Failed to fetch golden cross stocks')
      }

      const gcData = await gcResponse.json()
      const symbols = gcData.data.map((s: any) => s.symbol)

      if (symbols.length === 0) {
        setStocks([])
        setLoading(false)
        return
      }

      // Analyze stocks with batch API
      const analysisResponse = await fetch('/api/signals/batch-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      })

      if (!analysisResponse.ok) {
        throw new Error('Failed to analyze stocks')
      }

      const analysisData = await analysisResponse.json()

      // Convert to AnalyzedStock format
      const analyzedStocks: AnalyzedStock[] = analysisData.data.map((stock: GoldenCrossStock) => ({
        ...stock,
        recommendationAction: 'THEO DÕI' as const,
        isAnalyzing: false,
        isSaving: false
      }))

      setStocks(analyzedStocks)
    } catch (err: any) {
      console.error('Error fetching golden cross stocks:', err)
      setError(err.message || 'Không thể tải danh sách cổ phiếu')
    } finally {
      setLoading(false)
    }
  }

  const analyzeWithGemini = async (symbol: string) => {
    setStocks(prev => prev.map(s =>
      s.symbol === symbol ? { ...s, isAnalyzing: true } : s
    ))

    try {
      // Fetch stock data for Gemini analysis
      const [pricesResponse, ratiosResponse, profitabilityResponse] = await Promise.all([
        fetch(`/api/vndirect/prices?symbol=${symbol}&days=270`),
        fetch(`/api/vndirect/ratios?symbol=${symbol}`),
        fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`)
      ])

      const pricesData = await pricesResponse.json()
      const ratiosData = await ratiosResponse.json()
      const profitabilityData = await profitabilityResponse.json().catch(() => null)

      if (!pricesData.data || pricesData.data.length === 0) {
        throw new Error('Không có dữ liệu giá')
      }

      // Prepare data for Gemini
      const sortedPrices = [...pricesData.data].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const closePrices = sortedPrices.map((d: any) => d.adClose)
      const currentPrice = closePrices[closePrices.length - 1]
      const volumes = sortedPrices.map((d: any) => d.nmVolume)

      const ma10 = calculateSMA(closePrices, 10)
      const ma30 = calculateSMA(closePrices, 30)
      const bb = calculateBollingerBands(closePrices, 20, 2)

      const latestIdx = closePrices.length - 1
      const avgVolume10 = volumes.slice(-10).reduce((a: number, b: number) => a + b, 0) / 10

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
          day5: ((currentPrice - closePrices[latestIdx - 5]) / closePrices[latestIdx - 5]) * 100,
          day10: ((currentPrice - closePrices[latestIdx - 10]) / closePrices[latestIdx - 10]) * 100
        },
        volume: {
          current: volumes[volumes.length - 1],
          avg10: avgVolume10,
          ratio: (volumes[volumes.length - 1] / avgVolume10) * 100
        },
        week52: {
          high: Math.max(...closePrices),
          low: Math.min(...closePrices)
        }
      }

      const ratiosMap: Record<string, any> = {}
      ratiosData.data.forEach((ratio: any) => {
        ratiosMap[ratio.ratioCode] = ratio
      })

      const fundamentalData = {
        pe: ratiosMap['PRICE_TO_EARNINGS']?.value,
        pb: ratiosMap['PRICE_TO_BOOK']?.value,
        roe: ratiosMap['ROAE_TR_AVG5Q']?.value,
        roa: ratiosMap['ROAA_TR_AVG5Q']?.value,
        dividendYield: ratiosMap['DIVIDEND_YIELD']?.value,
        marketCap: ratiosMap['MARKETCAP']?.value,
        freeFloat: ratiosMap['FREEFLOAT']?.value,
        profitability: profitabilityData
      }

      // Call Gemini API
      const geminiResponse = await fetch('/api/gemini/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          technicalData,
          fundamentalData,
          recommendations: []
        })
      })

      if (!geminiResponse.ok) {
        throw new Error('Gemini analysis failed')
      }

      const geminiData = await geminiResponse.json()

      // Determine recommendation action
      let action: 'MUA' | 'THEO DÕI' | 'BỎ QUA' = 'THEO DÕI'

      if (
        geminiData.shortTerm.signal.includes('MUA') &&
        geminiData.longTerm.signal.includes('MUA') &&
        geminiData.shortTerm.confidence >= 60 &&
        geminiData.longTerm.confidence >= 60
      ) {
        action = 'MUA'
      } else if (
        geminiData.shortTerm.signal.includes('BÁN') ||
        geminiData.longTerm.signal.includes('BÁN')
      ) {
        action = 'BỎ QUA'
      }

      setStocks(prev => prev.map(s =>
        s.symbol === symbol
          ? {
              ...s,
              geminiAnalysis: geminiData,
              recommendationAction: action,
              isAnalyzing: false
            }
          : s
      ))
    } catch (err: any) {
      console.error(`Error analyzing ${symbol}:`, err)
      setStocks(prev => prev.map(s =>
        s.symbol === symbol ? { ...s, isAnalyzing: false } : s
      ))
    }
  }

  const analyzeAllStocks = async () => {
    setAnalyzingAll(true)

    for (const stock of stocks) {
      if (!stock.geminiAnalysis) {
        await analyzeWithGemini(stock.symbol)
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    setAnalyzingAll(false)
  }

  const saveRecommendation = async (stock: AnalyzedStock) => {
    if (!stock.geminiAnalysis) return

    setStocks(prev => prev.map(s =>
      s.symbol === stock.symbol ? { ...s, isSaving: true } : s
    ))

    try {
      const response = await fetch('/api/signals/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: stock.symbol,
          recommendedPrice: stock.currentPrice,
          currentPrice: stock.currentPrice,
          targetPrice: stock.geminiAnalysis.targetPrice,
          stopLoss: stock.geminiAnalysis.stopLoss,
          confidence: stock.geminiAnalysis.shortTerm.confidence,
          aiSignal: stock.recommendationAction,
          technicalAnalysis: [
            `MA10: ${stock.ma10.toFixed(2)}`,
            `MA30: ${stock.ma30.toFixed(2)}`,
            stock.geminiAnalysis.shortTerm.summary
          ],
          fundamentalAnalysis: stock.fundamentalReasons,
          risks: stock.geminiAnalysis.risks,
          opportunities: stock.geminiAnalysis.opportunities
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save recommendation')
      }

      alert(`✅ Đã lưu khuyến nghị MUA cho ${stock.symbol}`)

      setStocks(prev => prev.map(s =>
        s.symbol === stock.symbol ? { ...s, isSaving: false } : s
      ))
    } catch (err: any) {
      console.error('Error saving recommendation:', err)
      alert(`❌ Lỗi khi lưu khuyến nghị: ${err.message}`)

      setStocks(prev => prev.map(s =>
        s.symbol === stock.symbol ? { ...s, isSaving: false } : s
      ))
    }
  }

  const calculateSMA = (prices: number[], period: number): number[] => {
    const sma: number[] = []
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(NaN)
        continue
      }
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      sma.push(sum / period)
    }
    return sma
  }

  const calculateBollingerBands = (prices: number[], period: number, stdDev: number) => {
    const sma = calculateSMA(prices, period)
    const upper: number[] = []
    const lower: number[] = []

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN)
        lower.push(NaN)
        continue
      }

      const slice = prices.slice(i - period + 1, i + 1)
      const mean = sma[i]
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
      const std = Math.sqrt(variance)

      upper.push(mean + stdDev * std)
      lower.push(mean - stdDev * std)
    }

    return { upper, middle: sma, lower }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'MUA':
        return 'bg-green-600 text-white'
      case 'THEO DÕI':
        return 'bg-yellow-600 text-white'
      case 'BỎ QUA':
        return 'bg-gray-600 text-white'
      default:
        return 'bg-blue-600 text-white'
    }
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center h-60">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-400">Đang tải danh sách Golden Cross...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (stocks.length === 0) {
    return (
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          📊 Cổ phiếu Golden Cross
        </h3>
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 text-blue-400">
          Chưa có cổ phiếu nào xuất hiện tín hiệu Golden Cross
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            📊 Cổ phiếu Golden Cross
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            {stocks.length} cổ phiếu đạt phân tích kỹ thuật và cơ bản tốt
          </p>
        </div>
        <button
          onClick={analyzeAllStocks}
          disabled={analyzingAll}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
        >
          {analyzingAll ? 'Đang phân tích...' : '🤖 Phân tích tất cả với AI'}
        </button>
      </div>

      <div className="space-y-4">
        {stocks.map((stock) => (
          <div
            key={stock.symbol}
            className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 rounded-lg p-5 border border-gray-700/50"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-white">{stock.symbol}</div>
                <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${getActionColor(stock.recommendationAction)}`}>
                  {stock.recommendationAction}
                </div>
                <div className="text-lg font-semibold text-green-400">
                  {formatPrice(stock.currentPrice)}
                </div>
              </div>

              <div className="flex gap-2">
                {!stock.geminiAnalysis && (
                  <button
                    onClick={() => analyzeWithGemini(stock.symbol)}
                    disabled={stock.isAnalyzing}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {stock.isAnalyzing ? '⏳ Đang phân tích...' : '🤖 Đánh giá AI'}
                  </button>
                )}
                {stock.recommendationAction === 'MUA' && stock.geminiAnalysis && (
                  <button
                    onClick={() => saveRecommendation(stock)}
                    disabled={stock.isSaving}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    {stock.isSaving ? '💾 Đang lưu...' : '💾 Lưu khuyến nghị'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-cyan-900/20 rounded-lg p-3 border border-cyan-700/30">
                <div className="text-xs text-gray-400">MA10</div>
                <div className="text-sm font-semibold text-cyan-400">{stock.ma10.toFixed(2)}</div>
              </div>
              <div className="bg-cyan-900/20 rounded-lg p-3 border border-cyan-700/30">
                <div className="text-xs text-gray-400">MA30</div>
                <div className="text-sm font-semibold text-cyan-400">{stock.ma30.toFixed(2)}</div>
              </div>
              {stock.pe && (
                <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-700/30">
                  <div className="text-xs text-gray-400">P/E</div>
                  <div className="text-sm font-semibold text-purple-400">{stock.pe.toFixed(2)}</div>
                </div>
              )}
              {stock.roe && (
                <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                  <div className="text-xs text-gray-400">ROE</div>
                  <div className="text-sm font-semibold text-green-400">{stock.roe.toFixed(2)}%</div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-300">Phân tích cơ bản:</div>
              {stock.fundamentalReasons.map((reason, idx) => (
                <div key={idx} className="text-sm text-gray-400 pl-2 border-l-2 border-purple-500/30">
                  ✓ {reason}
                </div>
              ))}
            </div>

            {stock.geminiAnalysis && (
              <div className="mt-4 pt-4 border-t border-gray-700/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-cyan-900/20 rounded-lg p-3 border border-cyan-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-cyan-300">⚡ Ngắn hạn</span>
                      <span className="text-sm text-gray-400">{stock.geminiAnalysis.shortTerm.confidence}%</span>
                    </div>
                    <p className="text-xs text-gray-300">{stock.geminiAnalysis.shortTerm.summary}</p>
                  </div>

                  <div className="bg-purple-900/20 rounded-lg p-3 border border-purple-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-purple-300">🎯 Dài hạn</span>
                      <span className="text-sm text-gray-400">{stock.geminiAnalysis.longTerm.confidence}%</span>
                    </div>
                    <p className="text-xs text-gray-300">{stock.geminiAnalysis.longTerm.summary}</p>
                  </div>
                </div>

                {(stock.geminiAnalysis.targetPrice || stock.geminiAnalysis.stopLoss) && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {stock.geminiAnalysis.targetPrice && (
                      <div className="bg-green-900/20 rounded-lg p-2 border border-green-700/30">
                        <div className="text-xs text-gray-400">🎯 Giá mục tiêu</div>
                        <div className="text-sm font-bold text-green-400">{stock.geminiAnalysis.targetPrice}</div>
                      </div>
                    )}
                    {stock.geminiAnalysis.stopLoss && (
                      <div className="bg-red-900/20 rounded-lg p-2 border border-red-700/30">
                        <div className="text-xs text-gray-400">🛑 Cắt lỗ</div>
                        <div className="text-sm font-bold text-red-400">{stock.geminiAnalysis.stopLoss}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
