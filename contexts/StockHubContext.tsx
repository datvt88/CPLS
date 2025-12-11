'use client'

/**
 * Stock Hub Context
 *
 * Central state management for stock data across the application.
 * Provides cached data sharing between widgets and enables Alpha AI
 * to access current stock context.
 *
 * Features:
 * - Centralized symbol management
 * - Cached stock data (prices, ratios, recommendations, profitability)
 * - Gemini analysis result caching
 * - Prevents duplicate API calls across widgets
 */

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'
import type { StockPriceData, FinancialRatio, StockRecommendation } from '@/types/vndirect'
import type { DeepAnalysisResult } from '@/lib/gemini/types'

// Profitability data type
interface ProfitabilityData {
  data: Array<{
    label: string
    y: number[]
    x?: string[]
  }>
}

// Technical indicators calculated from price data
interface TechnicalIndicators {
  ma10: number | null
  ma30: number | null
  bollinger: {
    upper: number
    middle: number
    lower: number
  } | null
  pivotPoints: {
    pivot: number
    R1: number
    R2: number
    R3: number
    S1: number
    S2: number
    S3: number
  } | null
  momentum5d: number | null
  momentum10d: number | null
}

// Complete stock data bundle
export interface StockData {
  symbol: string
  prices: StockPriceData[]
  ratios: Record<string, FinancialRatio>
  recommendations: StockRecommendation[]
  profitability: ProfitabilityData | null
  technicalIndicators: TechnicalIndicators | null
  lastUpdated: number
}

// Loading states for different data types
interface LoadingStates {
  prices: boolean
  ratios: boolean
  recommendations: boolean
  profitability: boolean
  geminiAnalysis: boolean
}

// Stock Hub Context value
interface StockHubContextValue {
  // Current symbol
  currentSymbol: string
  setCurrentSymbol: (symbol: string) => void

  // Cached stock data
  stockData: StockData | null

  // Individual setters for widgets to push data
  setPrices: (prices: StockPriceData[]) => void
  setRatios: (ratios: FinancialRatio[]) => void
  setRecommendations: (recs: StockRecommendation[]) => void
  setProfitability: (data: ProfitabilityData | null) => void
  setTechnicalIndicators: (indicators: TechnicalIndicators) => void

  // Gemini analysis result
  geminiAnalysis: DeepAnalysisResult | null
  setGeminiAnalysis: (result: DeepAnalysisResult | null) => void

  // Loading states
  loading: LoadingStates
  setLoading: (key: keyof LoadingStates, value: boolean) => void

  // Error state
  error: string | null
  setError: (error: string | null) => void

  // Check if data is stale (older than cache duration)
  isDataStale: () => boolean

  // Clear all cached data
  clearCache: () => void

  // Format stock context for Alpha AI
  formatStockContextForAlpha: () => string
}

const StockHubContext = createContext<StockHubContextValue | null>(null)

// Cache duration: 2 minutes for stock data
const CACHE_DURATION = 2 * 60 * 1000

interface StockHubProviderProps {
  children: ReactNode
  initialSymbol?: string
}

export function StockHubProvider({ children, initialSymbol = 'VNM' }: StockHubProviderProps) {
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

  // Use ref to track current symbol for async operations
  const currentSymbolRef = useRef(currentSymbol)

  // Set current symbol and clear cache if symbol changes
  const setCurrentSymbol = useCallback((symbol: string) => {
    const upperSymbol = symbol.toUpperCase().trim()
    if (upperSymbol !== currentSymbolRef.current) {
      currentSymbolRef.current = upperSymbol
      setCurrentSymbolState(upperSymbol)
      // Clear cache when symbol changes
      setStockData(null)
      setGeminiAnalysisState(null)
      setError(null)
    }
  }, [])

  // Set prices data
  const setPrices = useCallback((prices: StockPriceData[]) => {
    setStockData(prev => ({
      symbol: currentSymbolRef.current,
      prices,
      ratios: prev?.ratios ?? {},
      recommendations: prev?.recommendations ?? [],
      profitability: prev?.profitability ?? null,
      technicalIndicators: prev?.technicalIndicators ?? null,
      lastUpdated: Date.now(),
    }))
  }, [])

  // Set ratios data
  const setRatios = useCallback((ratiosArray: FinancialRatio[]) => {
    const ratiosMap: Record<string, FinancialRatio> = {}
    ratiosArray.forEach(r => {
      ratiosMap[r.ratioCode] = r
    })

    setStockData(prev => ({
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: ratiosMap,
      recommendations: prev?.recommendations ?? [],
      profitability: prev?.profitability ?? null,
      technicalIndicators: prev?.technicalIndicators ?? null,
      lastUpdated: Date.now(),
    }))
  }, [])

  // Set recommendations data
  const setRecommendations = useCallback((recs: StockRecommendation[]) => {
    setStockData(prev => ({
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: prev?.ratios ?? {},
      recommendations: recs,
      profitability: prev?.profitability ?? null,
      technicalIndicators: prev?.technicalIndicators ?? null,
      lastUpdated: Date.now(),
    }))
  }, [])

  // Set profitability data
  const setProfitability = useCallback((data: ProfitabilityData | null) => {
    setStockData(prev => ({
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: prev?.ratios ?? {},
      recommendations: prev?.recommendations ?? [],
      profitability: data,
      technicalIndicators: prev?.technicalIndicators ?? null,
      lastUpdated: Date.now(),
    }))
  }, [])

  // Set technical indicators
  const setTechnicalIndicators = useCallback((indicators: TechnicalIndicators) => {
    setStockData(prev => ({
      symbol: currentSymbolRef.current,
      prices: prev?.prices ?? [],
      ratios: prev?.ratios ?? {},
      recommendations: prev?.recommendations ?? [],
      profitability: prev?.profitability ?? null,
      technicalIndicators: indicators,
      lastUpdated: Date.now(),
    }))
  }, [])

  // Set Gemini analysis result
  const setGeminiAnalysis = useCallback((result: DeepAnalysisResult | null) => {
    setGeminiAnalysisState(result)
  }, [])

  // Set loading state for specific key
  const setLoading = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoadingState(prev => ({ ...prev, [key]: value }))
  }, [])

  // Check if data is stale
  const isDataStale = useCallback(() => {
    if (!stockData || stockData.symbol !== currentSymbol) return true
    return Date.now() - stockData.lastUpdated > CACHE_DURATION
  }, [stockData, currentSymbol])

  // Clear all cached data
  const clearCache = useCallback(() => {
    setStockData(null)
    setGeminiAnalysisState(null)
    setError(null)
  }, [])

  // Format stock context for Alpha AI
  const formatStockContextForAlpha = useCallback((): string => {
    if (!stockData || stockData.symbol !== currentSymbol) {
      return ''
    }

    const lines: string[] = []
    lines.push(`📊 DỮ LIỆU CỔ PHIẾU ${stockData.symbol} ĐANG XEM:`)
    lines.push('=' .repeat(50))

    // Price data
    if (stockData.prices.length > 0) {
      const latest = stockData.prices[stockData.prices.length - 1]
      lines.push(`\n📈 GIÁ HIỆN TẠI:`)
      lines.push(`- Giá đóng cửa: ${latest.close.toLocaleString('vi-VN')} VNĐ`)
      lines.push(`- Thay đổi: ${latest.change > 0 ? '+' : ''}${latest.change.toLocaleString('vi-VN')} (${latest.pctChange > 0 ? '+' : ''}${latest.pctChange.toFixed(2)}%)`)
      lines.push(`- Khối lượng: ${latest.nmVolume.toLocaleString('vi-VN')}`)
      lines.push(`- Ngày: ${new Date(latest.date).toLocaleDateString('vi-VN')}`)
    }

    // Technical indicators
    if (stockData.technicalIndicators) {
      const ti = stockData.technicalIndicators
      lines.push(`\n📊 CHỈ BÁO KỸ THUẬT:`)
      if (ti.ma10 !== null) lines.push(`- MA10: ${ti.ma10.toLocaleString('vi-VN')}`)
      if (ti.ma30 !== null) lines.push(`- MA30: ${ti.ma30.toLocaleString('vi-VN')}`)
      if (ti.bollinger) {
        lines.push(`- Bollinger Upper: ${ti.bollinger.upper.toLocaleString('vi-VN')}`)
        lines.push(`- Bollinger Lower: ${ti.bollinger.lower.toLocaleString('vi-VN')}`)
      }
      if (ti.pivotPoints) {
        lines.push(`- Buy T+ (S2): ${ti.pivotPoints.S2.toLocaleString('vi-VN')}`)
        lines.push(`- Sell T+ (R3): ${ti.pivotPoints.R3.toLocaleString('vi-VN')}`)
      }
      if (ti.momentum5d !== null) lines.push(`- Momentum 5D: ${ti.momentum5d > 0 ? '+' : ''}${ti.momentum5d.toFixed(2)}%`)
    }

    // Fundamental ratios
    if (Object.keys(stockData.ratios).length > 0) {
      lines.push(`\n💰 CHỈ SỐ CƠ BẢN:`)
      const pe = stockData.ratios['PRICE_TO_EARNINGS']?.value
      const pb = stockData.ratios['PRICE_TO_BOOK']?.value
      const roe = stockData.ratios['ROAE_TR_AVG5Q']?.value
      const marketCap = stockData.ratios['MARKETCAP']?.value

      if (pe) lines.push(`- P/E: ${pe.toFixed(2)}x`)
      if (pb) lines.push(`- P/B: ${pb.toFixed(2)}x`)
      if (roe) lines.push(`- ROE: ${(roe * 100).toFixed(2)}%`)
      if (marketCap) lines.push(`- Vốn hóa: ${(marketCap / 1e9).toFixed(2)} tỷ VNĐ`)
    }

    // Recommendations
    if (stockData.recommendations.length > 0) {
      lines.push(`\n🎯 KHUYẾN NGHỊ ANALYST (${stockData.recommendations.length} công ty):`)
      const buyCount = stockData.recommendations.filter(r => r.type === 'BUY').length
      const holdCount = stockData.recommendations.filter(r => r.type === 'HOLD').length
      const sellCount = stockData.recommendations.filter(r => r.type === 'SELL').length
      lines.push(`- MUA: ${buyCount} | NẮM GIỮ: ${holdCount} | BÁN: ${sellCount}`)

      const avgTarget = stockData.recommendations.reduce((sum, r) => sum + (r.targetPrice || 0), 0) / stockData.recommendations.length
      if (avgTarget > 0) {
        lines.push(`- Giá mục tiêu TB: ${avgTarget.toLocaleString('vi-VN')} VNĐ`)
      }
    }

    // Gemini analysis if available
    if (geminiAnalysis) {
      lines.push(`\n🤖 PHÂN TÍCH GEMINI AI:`)
      lines.push(`- Ngắn hạn: ${geminiAnalysis.shortTerm.signal} (${geminiAnalysis.shortTerm.confidence}%)`)
      lines.push(`- Dài hạn: ${geminiAnalysis.longTerm.signal} (${geminiAnalysis.longTerm.confidence}%)`)
      if (geminiAnalysis.buyPrice) lines.push(`- Vùng mua: ${geminiAnalysis.buyPrice}`)
      if (geminiAnalysis.targetPrice) lines.push(`- Mục tiêu: ${geminiAnalysis.targetPrice}`)
      if (geminiAnalysis.stopLoss) lines.push(`- Cắt lỗ: ${geminiAnalysis.stopLoss}`)
    }

    lines.push('\n' + '=' .repeat(50))

    return lines.join('\n')
  }, [stockData, currentSymbol, geminiAnalysis])

  const value: StockHubContextValue = {
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
  }

  return (
    <StockHubContext.Provider value={value}>
      {children}
    </StockHubContext.Provider>
  )
}

// Custom hook to use Stock Hub
export function useStockHub() {
  const context = useContext(StockHubContext)
  if (!context) {
    throw new Error('useStockHub must be used within a StockHubProvider')
  }
  return context
}

// Optional hook that returns null if not in provider (for components that may be used outside)
export function useStockHubOptional() {
  return useContext(StockHubContext)
}
