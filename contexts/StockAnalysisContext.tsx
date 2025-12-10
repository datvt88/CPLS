'use client'

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import type { FinancialRatio } from '@/types/vndirect'

// Technical data structure
export interface TechnicalData {
  currentPrice: number
  ma10?: number
  ma30?: number
  bollinger?: {
    upper: number
    middle: number
    lower: number
  }
  momentum?: {
    day5: number
    day10: number
  }
  volume?: {
    current: number
    avg10: number
    ratio: number
  }
  week52?: {
    high: number
    low: number
  }
  buyPrice?: number
  priceData?: any[]  // Raw price data array
}

// Fundamental data structure
export interface FundamentalData {
  pe?: number
  pb?: number
  roe?: number
  roa?: number
  dividendYield?: number
  marketCap?: number
  freeFloat?: number
  eps?: number
  bvps?: number
  profitability?: {
    quarters: string[]
    metrics: any[]
  } | null
}

// Analyst recommendation structure
export interface AnalystRecommendation {
  firm: string
  type: string
  reportDate: string
  targetPrice?: number
  reportPrice?: number
}

// Stock analysis data stored in context
export interface StockAnalysisData {
  symbol: string
  technicalData: TechnicalData | null
  fundamentalData: FundamentalData | null
  recommendations: AnalystRecommendation[]
  ratiosMap: Record<string, FinancialRatio>
  profitabilityData: any | null
  lastUpdated: number
  isLoading: boolean
}

// Context value type
interface StockAnalysisContextValue {
  data: StockAnalysisData | null
  currentSymbol: string

  // Methods to update data
  setSymbol: (symbol: string) => void
  publishData: (data: Omit<StockAnalysisData, 'lastUpdated' | 'isLoading'>) => void
  setLoading: (loading: boolean) => void
  clearData: () => void

  // Helper to check if data is fresh (within 5 minutes)
  isDataFresh: () => boolean

  // Get data for a specific symbol (for Alpha AI to query)
  getDataForSymbol: (symbol: string) => StockAnalysisData | null
}

const StockAnalysisContext = createContext<StockAnalysisContextValue | null>(null)

interface StockAnalysisProviderProps {
  children: ReactNode
  initialSymbol?: string
}

export function StockAnalysisProvider({ children, initialSymbol = 'VNM' }: StockAnalysisProviderProps) {
  const [currentSymbol, setCurrentSymbol] = useState(initialSymbol)
  const [dataMap, setDataMap] = useState<Map<string, StockAnalysisData>>(new Map())

  // Get current data for the active symbol
  const data = dataMap.get(currentSymbol) || null

  // Reset data when symbol changes
  const setSymbol = useCallback((symbol: string) => {
    if (symbol !== currentSymbol) {
      setCurrentSymbol(symbol)
      // Don't clear data immediately - allow GeminiWidget to use cached data if available
    }
  }, [currentSymbol])

  // Publish new data to context
  const publishData = useCallback((newData: Omit<StockAnalysisData, 'lastUpdated' | 'isLoading'>) => {
    const fullData: StockAnalysisData = {
      ...newData,
      lastUpdated: Date.now(),
      isLoading: false
    }

    setDataMap(prev => {
      const updated = new Map(prev)
      updated.set(newData.symbol, fullData)
      // Keep only last 5 symbols in cache to prevent memory bloat
      if (updated.size > 5) {
        const keys = Array.from(updated.keys())
        updated.delete(keys[0])
      }
      return updated
    })

    console.log(`📊 StockAnalysisContext: Published data for ${newData.symbol}`, {
      hasTechnical: !!newData.technicalData,
      hasFundamental: !!newData.fundamentalData,
      recommendationsCount: newData.recommendations?.length || 0
    })
  }, [])

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    setDataMap(prev => {
      const current = prev.get(currentSymbol)
      if (!current) return prev

      const updated = new Map(prev)
      updated.set(currentSymbol, { ...current, isLoading: loading })
      return updated
    })
  }, [currentSymbol])

  // Clear all data
  const clearData = useCallback(() => {
    setDataMap(new Map())
  }, [])

  // Check if current data is fresh (within 5 minutes)
  const isDataFresh = useCallback(() => {
    const current = dataMap.get(currentSymbol)
    if (!current) return false

    const fiveMinutes = 5 * 60 * 1000
    return (Date.now() - current.lastUpdated) < fiveMinutes
  }, [dataMap, currentSymbol])

  // Get data for a specific symbol (useful for Alpha AI queries)
  const getDataForSymbol = useCallback((symbol: string): StockAnalysisData | null => {
    return dataMap.get(symbol) || null
  }, [dataMap])

  const value: StockAnalysisContextValue = {
    data,
    currentSymbol,
    setSymbol,
    publishData,
    setLoading,
    clearData,
    isDataFresh,
    getDataForSymbol
  }

  return (
    <StockAnalysisContext.Provider value={value}>
      {children}
    </StockAnalysisContext.Provider>
  )
}

// Hook to use the context
export function useStockAnalysis() {
  const context = useContext(StockAnalysisContext)
  if (!context) {
    throw new Error('useStockAnalysis must be used within a StockAnalysisProvider')
  }
  return context
}

// Hook to get data for Alpha AI
export function useStockDataQuery() {
  const context = useContext(StockAnalysisContext)
  if (!context) {
    return null
  }

  return {
    getCurrentData: () => context.data,
    getDataForSymbol: context.getDataForSymbol,
    currentSymbol: context.currentSymbol
  }
}
