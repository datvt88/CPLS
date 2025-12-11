/**
 * Gemini Types - Shared types for all Gemini services
 */

// Model types
export interface GeminiModel {
  id: string
  name: string
  description: string
  status: 'active' | 'experimental' | 'retired'
}

// Signal types
export type Signal = 'MUA' | 'BÁN' | 'THEO DÕI' | 'BUY' | 'SELL' | 'HOLD'

// Analysis result types
export interface AnalysisResult {
  signal: Signal
  confidence: number
  summary: string
}

export interface DeepAnalysisResult {
  shortTerm: {
    signal: Signal
    confidence: number
    summary: string
  }
  longTerm: {
    signal: Signal
    confidence: number
    summary: string
  }
  buyPrice: string | null
  targetPrice: string | null
  stopLoss: string | null
  risks: string[]
  opportunities: string[]
  rawText?: string
}

export interface AlphaResponse {
  text?: string
  error?: string
}

// Request types
export interface DeepAnalysisRequest {
  symbol: string
  technicalData?: {
    currentPrice?: number
    buyPrice?: number
    ma10?: number
    ma30?: number
    bollinger?: {
      upper: number
      middle: number
      lower: number
    }
    momentum?: {
      day5?: number
      day10?: number
    }
    volume?: {
      current?: number
      avg10?: number
      ratio?: number
    }
    week52?: {
      high?: number
      low?: number
    }
    maSignal?: string
  }
  fundamentalData?: {
    pe?: number
    pb?: number
    roe?: number
    roa?: number
    eps?: number
    dividendYield?: number
    marketCap?: number
    profitability?: {
      quarters: string[]
      metrics: Array<{
        label: string
        y: number[]
      }>
    }
  }
  recommendations?: Array<{
    type: string
    targetPrice?: number
  }>
  model?: string
}

export interface MarketSignalRequest {
  stockCode: string
  model?: string
}
