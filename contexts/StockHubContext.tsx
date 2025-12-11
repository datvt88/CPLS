'use client'

/**
 * Stock Hub Context - Central Data Hub for Stock Widgets
 *
 * Role:
 * 1. Memory Storage: Caches all widget results (technical, fundamental, evaluations)
 * 2. Request Intermediary: Coordinates data sharing between widgets
 * 3. Context Generator: Creates context strings for AI analysis
 *
 * Data Flow:
 * - Widgets push data here after fetching
 * - Other widgets read from cache before fetching
 * - GeminiAnalysisWidget orchestrates analysis using this data
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useMemo } from 'react'
import type { StockPriceData, FinancialRatio, StockRecommendation } from '@/types/vndirect'
import type { DeepAnalysisResult } from '@/lib/gemini/types'

// --- 1. TYPE DEFINITIONS ---

// Profitability data structure (from DNSE API)
export interface ProfitabilityData {
  data: Array<{
    label: string
    y: number[]
    x?: string[]
  }>
}

// Technical indicators calculated from price data
export interface TechnicalIndicators {
  ma10: number | null
  ma30: number | null
  bollinger: {
    upper: number
    middle: number
    lower: number
  } | null
  pivotPoints: {
    pivot: number
    S1: number
    S2: number
    R1: number
    R2: number
    R3: number
  } | null
  momentum5d: number | null
  week52?: {
    high: number
    low: number
  }
}

// Analyst evaluation summary
export interface AnalystEvaluation {
  totalCount: number
  buyCount: number
  holdCount: number
  sellCount: number
  avgTargetPrice: number | null
  latestRecommendations: StockRecommendation[]
}

// Complete stock data object
export interface StockData {
  symbol: string
  // Price & Technical
  prices: StockPriceData[]
  technicalIndicators: TechnicalIndicators | null
  // Fundamental
  ratios: Record<string, FinancialRatio>
  profitability: ProfitabilityData | null
  // Evaluations
  recommendations: StockRecommendation[]
  analystEvaluation: AnalystEvaluation | null
  // Metadata
  lastUpdated: number
  pricesUpdatedAt: number | null
  ratiosUpdatedAt: number | null
  recommendationsUpdatedAt: number | null
}

// Loading states for each data category
interface LoadingStates {
  prices: boolean
  ratios: boolean
  recommendations: boolean
  profitability: boolean
  geminiAnalysis: boolean
}

// Request types for inter-widget communication
export type DataRequestType = 'prices' | 'ratios' | 'recommendations' | 'profitability' | 'geminiAnalysis'

// Context value interface
interface StockHubContextValue {
  // State
  currentSymbol: string
  stockData: StockData | null
  geminiAnalysis: DeepAnalysisResult | null
  loading: LoadingStates
  error: string | null

  // Symbol Management
  setCurrentSymbol: (symbol: string) => void

  // Data Setters (called by widgets after fetching)
  setPrices: (prices: StockPriceData[]) => void
  setRatios: (ratiosArray: FinancialRatio[]) => void
  setRecommendations: (recs: StockRecommendation[]) => void
  setProfitability: (data: ProfitabilityData | null) => void
  setTechnicalIndicators: (indicators: TechnicalIndicators) => void
  setGeminiAnalysis: (result: DeepAnalysisResult | null) => void

  // State Management
  setLoading: (key: keyof LoadingStates, value: boolean) => void
  setError: (error: string | null) => void
  clearCache: () => void

  // Data Staleness Checks
  isDataStale: () => boolean
  isPricesStale: () => boolean
  isRatiosStale: () => boolean
  isRecommendationsStale: () => boolean

  // Request Intermediary
  requestData: (type: DataRequestType) => void
  onDataRequest: (callback: (type: DataRequestType) => void) => () => void

  // Context Generation for AI
  formatStockContextForAlpha: () => string
  getAnalysisPayload: () => AnalysisPayload | null
}

// Payload structure for Gemini Analysis
export interface AnalysisPayload {
  symbol: string
  technicalData: {
    currentPrice: number
    buyPrice?: number
    maSignal: string
    ma10: number | null
    ma30: number | null
    bollinger?: { upper: number; lower: number; middle: number }
    momentum?: { day5: number; day10?: number }
    volume?: { current: number; avg10: number; ratio?: number }
    week52?: { high: number; low: number }
  }
  fundamentalData: {
    pe?: number
    pb?: number
    roe?: number
    roa?: number
    dividendYield?: number
    marketCap?: number
    eps?: number
    profitability?: ProfitabilityData | null
  }
  recommendations: StockRecommendation[]
}

const StockHubContext = createContext<StockHubContextValue | null>(null)

// Cache durations (in milliseconds)
const CACHE_DURATION = {
  prices: 2 * 60 * 1000,        // 2 minutes for prices (more volatile)
  ratios: 10 * 60 * 1000,       // 10 minutes for ratios (less volatile)
  recommendations: 30 * 60 * 1000, // 30 minutes for recommendations
  default: 5 * 60 * 1000,       // 5 minutes default
}

// --- 2. PROVIDER COMPONENT ---

export function StockHubProvider({ children, initialSymbol = 'HPG' }: { children: ReactNode, initialSymbol?: string }) {
  const [currentSymbol, setCurrentSymbolState] = useState(initialSymbol)
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [geminiAnalysis, setGeminiAnalysisState] = useState<DeepAnalysisResult | null>(null)

  const [loading, setLoadingState] = useState<LoadingStates>({
    prices: false,
    ratios: false,
    recommendations: false,
    profitability: false,
    geminiAnalysis: false,
  })
  const [error, setError] = useState<string | null>(null)

  // Refs for async safety
  const currentSymbolRef = useRef(currentSymbol)
  const dataRequestListeners = useRef<Set<(type: DataRequestType) => void>>(new Set())

  // --- SYMBOL MANAGEMENT ---

  const setCurrentSymbol = useCallback((symbol: string) => {
    const upper = symbol.toUpperCase().trim()
    if (upper !== currentSymbolRef.current) {
      console.log(`[StockHub] Symbol: ${currentSymbolRef.current} -> ${upper}`)
      currentSymbolRef.current = upper
      setCurrentSymbolState(upper)

      // Reset all data when symbol changes
      setStockData(null)
      setGeminiAnalysisState(null)
      setError(null)
    }
  }, [])

  // --- DATA SETTERS ---

  const updateStockData = useCallback((updater: (prev: StockData | null) => StockData) => {
    setStockData(prev => {
      const newData = updater(prev)
      // Safety: ensure data matches current symbol
      if (newData.symbol !== currentSymbolRef.current) return prev
      return newData
    })
  }, [])

  const setPrices = useCallback((prices: StockPriceData[]) => {
    updateStockData(prev => ({
      symbol: currentSymbolRef.current,
      prices,
      ratios: prev?.ratios ?? {},
      recommendations: prev?.recommendations ?? [],
      profitability: prev?.profitability ?? null,
      technicalIndicators: prev?.technicalIndicators ?? null,
      analystEvaluation: prev?.analystEvaluation ?? null,
      lastUpdated: Date.now(),
      pricesUpdatedAt: Date.now(),
      ratiosUpdatedAt: prev?.ratiosUpdatedAt ?? null,
      recommendationsUpdatedAt: prev?.recommendationsUpdatedAt ?? null,
    }))
  }, [updateStockData])

  const setRatios = useCallback((ratiosArray: FinancialRatio[]) => {
    const ratiosMap: Record<string, FinancialRatio> = {}
    ratiosArray.forEach(r => ratiosMap[r.ratioCode] = r)

    updateStockData(prev => ({
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: ratiosMap,
      recommendations: prev?.recommendations ?? [],
      profitability: prev?.profitability ?? null,
      technicalIndicators: prev?.technicalIndicators ?? null,
      analystEvaluation: prev?.analystEvaluation ?? null,
      lastUpdated: Date.now(),
      pricesUpdatedAt: prev?.pricesUpdatedAt ?? null,
      ratiosUpdatedAt: Date.now(),
      recommendationsUpdatedAt: prev?.recommendationsUpdatedAt ?? null,
    }))
  }, [updateStockData])

  const setRecommendations = useCallback((recs: StockRecommendation[]) => {
    // Calculate analyst evaluation summary
    const buyCount = recs.filter(r =>
      r.type?.toUpperCase() === 'BUY' || r.type?.toUpperCase() === 'MUA'
    ).length
    const holdCount = recs.filter(r =>
      r.type?.toUpperCase() === 'HOLD' || r.type?.toUpperCase() === 'GIỮ' || r.type?.toUpperCase() === 'NAM GIU'
    ).length
    const sellCount = recs.filter(r =>
      r.type?.toUpperCase() === 'SELL' || r.type?.toUpperCase() === 'BÁN'
    ).length

    const recsWithTarget = recs.filter(r => r.targetPrice && !isNaN(r.targetPrice))
    const avgTargetPrice = recsWithTarget.length > 0
      ? recsWithTarget.reduce((sum, r) => sum + r.targetPrice!, 0) / recsWithTarget.length
      : null

    const evaluation: AnalystEvaluation = {
      totalCount: recs.length,
      buyCount,
      holdCount,
      sellCount,
      avgTargetPrice,
      latestRecommendations: recs.slice(0, 5)
    }

    updateStockData(prev => ({
      ...prev!,
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: prev?.ratios ?? {},
      recommendations: recs,
      profitability: prev?.profitability ?? null,
      technicalIndicators: prev?.technicalIndicators ?? null,
      analystEvaluation: evaluation,
      lastUpdated: Date.now(),
      pricesUpdatedAt: prev?.pricesUpdatedAt ?? null,
      ratiosUpdatedAt: prev?.ratiosUpdatedAt ?? null,
      recommendationsUpdatedAt: Date.now(),
    }))
  }, [updateStockData])

  const setProfitability = useCallback((data: ProfitabilityData | null) => {
    updateStockData(prev => ({
      ...prev!,
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: prev?.ratios ?? {},
      recommendations: prev?.recommendations ?? [],
      profitability: data,
      technicalIndicators: prev?.technicalIndicators ?? null,
      analystEvaluation: prev?.analystEvaluation ?? null,
      lastUpdated: Date.now(),
      pricesUpdatedAt: prev?.pricesUpdatedAt ?? null,
      ratiosUpdatedAt: prev?.ratiosUpdatedAt ?? null,
      recommendationsUpdatedAt: prev?.recommendationsUpdatedAt ?? null,
    }))
  }, [updateStockData])

  const setTechnicalIndicators = useCallback((indicators: TechnicalIndicators) => {
    updateStockData(prev => ({
      ...prev!,
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: prev?.ratios ?? {},
      recommendations: prev?.recommendations ?? [],
      profitability: prev?.profitability ?? null,
      technicalIndicators: indicators,
      analystEvaluation: prev?.analystEvaluation ?? null,
      lastUpdated: Date.now(),
      pricesUpdatedAt: prev?.pricesUpdatedAt ?? null,
      ratiosUpdatedAt: prev?.ratiosUpdatedAt ?? null,
      recommendationsUpdatedAt: prev?.recommendationsUpdatedAt ?? null,
    }))
  }, [updateStockData])

  const setGeminiAnalysis = useCallback((result: DeepAnalysisResult | null) => {
    setGeminiAnalysisState(result)
  }, [])

  const setLoading = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoadingState(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearCache = useCallback(() => {
    setStockData(null)
    setGeminiAnalysisState(null)
  }, [])

  // --- STALENESS CHECKS ---

  const isDataStale = useCallback(() => {
    if (!stockData || stockData.symbol !== currentSymbol) return true
    return Date.now() - stockData.lastUpdated > CACHE_DURATION.default
  }, [stockData, currentSymbol])

  const isPricesStale = useCallback(() => {
    if (!stockData || stockData.symbol !== currentSymbol || !stockData.pricesUpdatedAt) return true
    return Date.now() - stockData.pricesUpdatedAt > CACHE_DURATION.prices
  }, [stockData, currentSymbol])

  const isRatiosStale = useCallback(() => {
    if (!stockData || stockData.symbol !== currentSymbol || !stockData.ratiosUpdatedAt) return true
    return Date.now() - stockData.ratiosUpdatedAt > CACHE_DURATION.ratios
  }, [stockData, currentSymbol])

  const isRecommendationsStale = useCallback(() => {
    if (!stockData || stockData.symbol !== currentSymbol || !stockData.recommendationsUpdatedAt) return true
    return Date.now() - stockData.recommendationsUpdatedAt > CACHE_DURATION.recommendations
  }, [stockData, currentSymbol])

  // --- REQUEST INTERMEDIARY ---

  const requestData = useCallback((type: DataRequestType) => {
    console.log(`[StockHub] Request: ${type} for ${currentSymbolRef.current}`)
    dataRequestListeners.current.forEach(listener => listener(type))
  }, [])

  const onDataRequest = useCallback((callback: (type: DataRequestType) => void) => {
    dataRequestListeners.current.add(callback)
    return () => {
      dataRequestListeners.current.delete(callback)
    }
  }, [])

  // --- CONTEXT GENERATION FOR AI ---

  const formatStockContextForAlpha = useCallback((): string => {
    if (!stockData || stockData.symbol !== currentSymbol) return ''

    const lines: string[] = []
    lines.push(`📊 THÔNG TIN CỔ PHIẾU ${stockData.symbol}:`)
    lines.push('=' .repeat(40))

    // 1. Price Info
    if (stockData.prices.length > 0) {
      const latest = stockData.prices[stockData.prices.length - 1]
      const changeSym = latest.change >= 0 ? '+' : ''
      lines.push(`\n💰 GIÁ HIỆN TẠI:`)
      lines.push(`- Giá: ${latest.close.toLocaleString()} đ`)
      lines.push(`- Biến động: ${changeSym}${latest.change.toLocaleString()} (${changeSym}${latest.pctChange.toFixed(2)}%)`)
      lines.push(`- Khối lượng: ${(latest.nmVolume / 1000).toFixed(0)}K cổ phiếu`)
    }

    // 2. Technical Indicators
    if (stockData.technicalIndicators) {
      const ti = stockData.technicalIndicators
      lines.push(`\n📈 CHỈ BÁO KỸ THUẬT:`)

      if (ti.ma10 !== null && ti.ma30 !== null) {
        const trend = ti.ma10 > ti.ma30 ? 'TĂNG (MA10 > MA30)' : 'GIẢM (MA10 < MA30)'
        lines.push(`- Xu hướng: ${trend}`)
        lines.push(`- MA10: ${ti.ma10.toLocaleString()} | MA30: ${ti.ma30.toLocaleString()}`)
      }

      if (ti.bollinger) {
        lines.push(`- Bollinger: ${ti.bollinger.lower.toLocaleString()} - ${ti.bollinger.upper.toLocaleString()}`)
      }

      if (ti.pivotPoints) {
        lines.push(`- Hỗ trợ (S2): ${ti.pivotPoints.S2.toLocaleString()} | Kháng cự (R3): ${ti.pivotPoints.R3.toLocaleString()}`)
      }

      if (ti.momentum5d !== null) {
        lines.push(`- Momentum 5D: ${ti.momentum5d > 0 ? '+' : ''}${ti.momentum5d.toFixed(2)}%`)
      }
    }

    // 3. Fundamental Ratios
    const r = stockData.ratios
    if (Object.keys(r).length > 0) {
      lines.push(`\n💼 CHỈ SỐ CƠ BẢN:`)
      const pe = r['PRICE_TO_EARNINGS']?.value
      const pb = r['PRICE_TO_BOOK']?.value
      const roe = r['ROAE_TR_AVG5Q']?.value
      const roa = r['ROAA_TR_AVG5Q']?.value
      if (pe) lines.push(`- P/E: ${pe.toFixed(1)}x`)
      if (pb) lines.push(`- P/B: ${pb.toFixed(2)}x`)
      if (roe) lines.push(`- ROE: ${(roe * 100).toFixed(1)}%`)
      if (roa) lines.push(`- ROA: ${(roa * 100).toFixed(1)}%`)
    }

    // 4. Analyst Evaluations
    if (stockData.analystEvaluation) {
      const eval_ = stockData.analystEvaluation
      lines.push(`\n🎯 ĐÁNH GIÁ CTCK (${eval_.totalCount} công ty):`)
      lines.push(`- MUA: ${eval_.buyCount} | GIỮ: ${eval_.holdCount} | BÁN: ${eval_.sellCount}`)
      if (eval_.avgTargetPrice) {
        lines.push(`- Giá mục tiêu TB: ${eval_.avgTargetPrice.toLocaleString()}`)
      }
    }

    // 5. Gemini Analysis (if available)
    if (geminiAnalysis) {
      lines.push(`\n🤖 NHẬN ĐỊNH AI:`)
      lines.push(`- Ngắn hạn: ${geminiAnalysis.shortTerm.signal} (${geminiAnalysis.shortTerm.confidence}%)`)
      lines.push(`- Dài hạn: ${geminiAnalysis.longTerm.signal} (${geminiAnalysis.longTerm.confidence}%)`)
      if (geminiAnalysis.buyPrice) lines.push(`- Vùng mua: ${geminiAnalysis.buyPrice.toLocaleString()}`)
      if (geminiAnalysis.targetPrice) lines.push(`- Mục tiêu: ${geminiAnalysis.targetPrice.toLocaleString()}`)
    }

    lines.push('\n' + '=' .repeat(40))
    return lines.join('\n')
  }, [stockData, currentSymbol, geminiAnalysis])

  // --- ANALYSIS PAYLOAD GENERATION ---

  const getAnalysisPayload = useCallback((): AnalysisPayload | null => {
    if (!stockData || stockData.prices.length < 30) return null

    const prices = stockData.prices
    const lastIdx = prices.length - 1
    const latest = prices[lastIdx]
    const ti = stockData.technicalIndicators
    const r = stockData.ratios

    // Calculate volume metrics
    const volumes = prices.map(p => p.nmVolume)
    const avgVol10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10

    // Calculate momentum
    const closePrices = prices.map(p => p.adClose)
    const momentum5d = lastIdx >= 5
      ? ((closePrices[lastIdx] - closePrices[lastIdx - 5]) / closePrices[lastIdx - 5]) * 100
      : 0

    const maSignal = ti?.ma10 && ti?.ma30
      ? (ti.ma10 > ti.ma30 ? 'Uptrend (MA10>MA30)' : 'Downtrend (MA10<MA30)')
      : 'N/A'

    return {
      symbol: stockData.symbol,
      technicalData: {
        currentPrice: latest.adClose,
        buyPrice: ti?.pivotPoints?.S2,
        maSignal,
        ma10: ti?.ma10 ?? null,
        ma30: ti?.ma30 ?? null,
        bollinger: ti?.bollinger ? {
          upper: ti.bollinger.upper,
          lower: ti.bollinger.lower,
          middle: ti.bollinger.middle
        } : undefined,
        momentum: { day5: momentum5d },
        volume: {
          current: latest.nmVolume,
          avg10: avgVol10,
          ratio: (latest.nmVolume / avgVol10) * 100
        },
        week52: ti?.week52
      },
      fundamentalData: {
        pe: r['PRICE_TO_EARNINGS']?.value,
        pb: r['PRICE_TO_BOOK']?.value,
        roe: r['ROAE_TR_AVG5Q']?.value ? r['ROAE_TR_AVG5Q'].value * 100 : undefined,
        roa: r['ROAA_TR_AVG5Q']?.value ? r['ROAA_TR_AVG5Q'].value * 100 : undefined,
        dividendYield: r['DIVIDEND_YIELD']?.value,
        marketCap: r['MARKETCAP']?.value,
        eps: r['EARNING_PER_SHARE']?.value,
        profitability: stockData.profitability
      },
      recommendations: stockData.recommendations.slice(0, 5)
    }
  }, [stockData])

  // --- CONTEXT VALUE ---

  const value = useMemo(() => ({
    // State
    currentSymbol,
    stockData,
    geminiAnalysis,
    loading,
    error,
    // Symbol
    setCurrentSymbol,
    // Data setters
    setPrices,
    setRatios,
    setRecommendations,
    setProfitability,
    setTechnicalIndicators,
    setGeminiAnalysis,
    // State management
    setLoading,
    setError,
    clearCache,
    // Staleness
    isDataStale,
    isPricesStale,
    isRatiosStale,
    isRecommendationsStale,
    // Request intermediary
    requestData,
    onDataRequest,
    // Context generation
    formatStockContextForAlpha,
    getAnalysisPayload,
  }), [
    currentSymbol, stockData, geminiAnalysis, loading, error,
    setCurrentSymbol, setPrices, setRatios, setRecommendations,
    setProfitability, setTechnicalIndicators, setGeminiAnalysis,
    setLoading, clearCache, isDataStale, isPricesStale,
    isRatiosStale, isRecommendationsStale, requestData, onDataRequest,
    formatStockContextForAlpha, getAnalysisPayload
  ])

  return (
    <StockHubContext.Provider value={value}>
      {children}
    </StockHubContext.Provider>
  )
}

// --- 3. HOOKS ---

// Required hook - throws if used outside provider
export function useStockHub() {
  const context = useContext(StockHubContext)
  if (!context) throw new Error('useStockHub must be used within a StockHubProvider')
  return context
}

// Optional hook - returns null if no provider
export function useStockHubOptional() {
  return useContext(StockHubContext)
}
