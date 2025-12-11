'use client'

/**
 * Stock Hub Context
 * * Central Nervous System for StockHub.
 * - Caches Market Data (Prices, Ratios) to reduce API calls.
 * - Caches AI Analysis Results (Gemini Hub).
 * - Generates Context for Gemini Alpha (Chatbot).
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useMemo } from 'react'
import type { StockPriceData, FinancialRatio, StockRecommendation } from '@/types/vndirect'
import type { DeepAnalysisResult } from '@/lib/gemini/types'

// --- 1. LOCAL TYPES ---

// Profitability data structure (chart format)
export interface ProfitabilityData {
  data: Array<{
    label: string
    y: number[]
    x?: string[]
  }>
}

// Technical indicators calculated locally or fetched
export interface TechnicalIndicators {
  ma10: number | null
  ma30: number | null
  bollinger: {
    upper: number
    middle: number
    lower: number
  } | null
  pivotPoints: {
    S2: number
    R3: number
    pivot: number
  } | null
  momentum5d: number | null
}

// The Big Object: Holds everything about a stock
export interface StockData {
  symbol: string
  prices: StockPriceData[]
  ratios: Record<string, FinancialRatio>
  recommendations: StockRecommendation[]
  profitability: ProfitabilityData | null
  technicalIndicators: TechnicalIndicators | null
  lastUpdated: number
}

interface LoadingStates {
  prices: boolean
  ratios: boolean
  recommendations: boolean
  profitability: boolean
  geminiAnalysis: boolean
}

interface StockHubContextValue {
  // State
  currentSymbol: string
  stockData: StockData | null
  geminiAnalysis: DeepAnalysisResult | null
  loading: LoadingStates
  error: string | null

  // Actions
  setCurrentSymbol: (symbol: string) => void
  setPrices: (prices: StockPriceData[]) => void
  setRatios: (ratiosArray: FinancialRatio[]) => void
  setRecommendations: (recs: StockRecommendation[]) => void
  setProfitability: (data: ProfitabilityData | null) => void
  setTechnicalIndicators: (indicators: TechnicalIndicators) => void
  setGeminiAnalysis: (result: DeepAnalysisResult | null) => void
  setLoading: (key: keyof LoadingStates, value: boolean) => void
  setError: (error: string | null) => void
  clearCache: () => void
  
  // Utilities
  isDataStale: () => boolean
  formatStockContextForAlpha: () => string // Crucial for Chat
}

const StockHubContext = createContext<StockHubContextValue | null>(null)

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000

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

  // Ref to prevent race conditions in async callbacks
  const currentSymbolRef = useRef(currentSymbol)

  // --- ACTIONS ---

  const setCurrentSymbol = useCallback((symbol: string) => {
    const upper = symbol.toUpperCase().trim()
    if (upper !== currentSymbolRef.current) {
      console.log(`🔄 StockHub: Switching symbol ${currentSymbolRef.current} -> ${upper}`)
      currentSymbolRef.current = upper
      setCurrentSymbolState(upper)
      
      // Reset logic: Clear old data immediately to avoid showing wrong stock info
      setStockData(null)
      setGeminiAnalysisState(null)
      setError(null)
    }
  }, [])

  // Generic setter for stock data to avoid repetition
  const updateStockData = useCallback((updater: (prev: StockData | null) => StockData) => {
    setStockData(prev => {
      // Safety check: ensure we are updating data for the current symbol
      const newData = updater(prev)
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
      lastUpdated: Date.now(),
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
      lastUpdated: Date.now(),
    }))
  }, [updateStockData])

  const setRecommendations = useCallback((recs: StockRecommendation[]) => {
    updateStockData(prev => ({ ...prev!, recommendations: recs, symbol: currentSymbolRef.current } as StockData))
  }, [updateStockData])

  const setProfitability = useCallback((data: ProfitabilityData | null) => {
    updateStockData(prev => ({ ...prev!, profitability: data, symbol: currentSymbolRef.current } as StockData))
  }, [updateStockData])

  const setTechnicalIndicators = useCallback((indicators: TechnicalIndicators) => {
    updateStockData(prev => ({ ...prev!, technicalIndicators: indicators, symbol: currentSymbolRef.current } as StockData))
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

  const isDataStale = useCallback(() => {
    if (!stockData || stockData.symbol !== currentSymbol) return true
    return Date.now() - stockData.lastUpdated > CACHE_DURATION
  }, [stockData, currentSymbol])

  // --- ALPHA CONTEXT GENERATOR ---
  // Hàm này tạo chuỗi text tóm tắt để gửi kèm vào prompt chat với Gemini Alpha
  const formatStockContextForAlpha = useCallback((): string => {
    if (!stockData || stockData.symbol !== currentSymbol) return ''

    const lines: string[] = []
    lines.push(`📊 THÔNG TIN CỔ PHIẾU ${stockData.symbol}:`)
    lines.push('--------------------------------')

    // 1. Price
    if (stockData.prices.length > 0) {
      const latest = stockData.prices[stockData.prices.length - 1]
      const changeSym = latest.change >= 0 ? '+' : ''
      lines.push(`- Giá: ${latest.close.toLocaleString()} đ`)
      lines.push(`- Biến động: ${changeSym}${latest.change.toLocaleString()} (${changeSym}${latest.pctChange.toFixed(2)}%)`)
      lines.push(`- Vol: ${(latest.nmVolume / 1000).toFixed(0)}K cổ phiếu`)
    }

    // 2. Technical Signals
    if (stockData.technicalIndicators) {
      const ti = stockData.technicalIndicators
      const signals = []
      if (ti.ma10 !== null && ti.ma30 !== null) {
        signals.push(ti.ma10 > ti.ma30 ? 'MA10 > MA30 (Tăng)' : 'MA10 < MA30 (Giảm)')
      }
      if (ti.momentum5d !== null) {
        signals.push(`Momentum 5D: ${ti.momentum5d > 0 ? 'Tích cực' : 'Tiêu cực'}`)
      }
      if (signals.length > 0) lines.push(`- Kỹ thuật: ${signals.join(', ')}`)
      
      if (ti.pivotPoints?.S2) {
        lines.push(`- Hỗ trợ mạnh (S2): ${ti.pivotPoints.S2.toLocaleString()}`)
      }
    }

    // 3. Fundamentals
    const r = stockData.ratios
    if (Object.keys(r).length > 0) {
      const pe = r['PRICE_TO_EARNINGS']?.value
      const roe = r['ROAE_TR_AVG5Q']?.value
      if (pe) lines.push(`- P/E: ${pe.toFixed(1)}x`)
      if (roe) lines.push(`- ROE: ${(roe * 100).toFixed(1)}%`)
    }

    // 4. Gemini Deep Analysis Result (Nếu có)
    if (geminiAnalysis) {
      lines.push('--------------------------------')
      lines.push('🤖 NHẬN ĐỊNH TỪ HUB (AI):')
      lines.push(`- Ngắn hạn: ${geminiAnalysis.shortTerm.signal} (${geminiAnalysis.shortTerm.summary})`)
      lines.push(`- Dài hạn: ${geminiAnalysis.longTerm.signal}`)
      if (geminiAnalysis.buyPrice) lines.push(`- Vùng mua AI gợi ý: ${geminiAnalysis.buyPrice.toLocaleString()}`)
    }

    return lines.join('\n')
  }, [stockData, currentSymbol, geminiAnalysis])

  // --- RENDER ---
  const value = useMemo(() => ({
    currentSymbol,
    setCurrentSymbol,
    stockData,
    setPrices,
    setRatios,
    setRecommendations,
    setProfitability,
    setTechnicalIndicators,
    geminiAnalysis,
    setGeminiAnalysis,
    loading,
    setLoading,
    error,
    setError,
    isDataStale,
    clearCache,
    formatStockContextForAlpha,
  }), [currentSymbol, stockData, geminiAnalysis, loading, error, isDataStale, formatStockContextForAlpha])

  return (
    <StockHubContext.Provider value={value}>
      {children}
    </StockHubContext.Provider>
  )
}

// Hook for components inside Provider
export function useStockHub() {
  const context = useContext(StockHubContext)
  if (!context) throw new Error('useStockHub must be used within a StockHubProvider')
  return context
}

// Hook for optional usage (returns null if no provider)
export function useStockHubOptional() {
  return useContext(StockHubContext)
}
