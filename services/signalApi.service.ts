// File: services/signalApi.service.ts
// Service to interact with CPLS Backend Signal API

import type {
  Signal,
  SignalStats,
  TopSignalsResponse,
  StrategyInfo,
  ScreenerResult,
  StockIndicator,
  PaginatedResponse,
  SignalFilters,
} from '@/types/signal'

const API_BASE_URL = 'https://cpls-be-230198333889.asia-southeast1.run.app/api/v1'
const DEFAULT_TIMEOUT = 15000 // 15 seconds

// Utility to create fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// ===== Signal Endpoints =====

/**
 * Get paginated signals with optional filters
 */
export async function getSignals(
  filters: SignalFilters = {}
): Promise<PaginatedResponse<Signal>> {
  const params = new URLSearchParams()

  if (filters.signal_type) params.append('signal_type', filters.signal_type)
  if (filters.strategy) params.append('strategy', filters.strategy)
  if (filters.min_confidence) params.append('min_confidence', filters.min_confidence.toString())
  if (filters.min_potential_gain) params.append('min_potential_gain', filters.min_potential_gain.toString())
  if (filters.signal_strength) params.append('signal_strength', filters.signal_strength)
  if (filters.stock_code) params.append('stock_code', filters.stock_code)
  if (filters.page) params.append('page', filters.page.toString())
  if (filters.limit) params.append('limit', filters.limit.toString())

  const url = `${API_BASE_URL}/signals${params.toString() ? `?${params.toString()}` : ''}`

  try {
    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch signals: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching signals:', error)
    return {
      data: [],
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
    }
  }
}

/**
 * Get signal for a specific stock
 */
export async function getStockSignal(stockCode: string): Promise<Signal | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/signals/stock/${stockCode}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch stock signal: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching stock signal:', error)
    return null
  }
}

/**
 * Get top buy/sell signals
 */
export async function getTopSignals(): Promise<TopSignalsResponse> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/signals/top`)
    if (!response.ok) {
      throw new Error(`Failed to fetch top signals: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching top signals:', error)
    return {
      top_buy: [],
      top_sell: [],
      most_confident: [],
      highest_potential: [],
    }
  }
}

/**
 * Get signal statistics
 */
export async function getSignalStats(): Promise<SignalStats | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/signals/stats`)
    if (!response.ok) {
      throw new Error(`Failed to fetch signal stats: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching signal stats:', error)
    return null
  }
}

/**
 * Get available strategies
 */
export async function getStrategies(): Promise<StrategyInfo[]> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/signals/strategies`)
    if (!response.ok) {
      throw new Error(`Failed to fetch strategies: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching strategies:', error)
    return []
  }
}

// ===== Screener Endpoints =====

type ScreenerType = 'buy' | 'sell' | 'momentum' | 'oversold' | 'breakout'

/**
 * Get screener results by type
 */
export async function getScreenerResults(
  type: ScreenerType,
  limit = 20
): Promise<ScreenerResult[]> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/signals/screener/${type}?limit=${limit}`
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch screener results: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`Error fetching ${type} screener:`, error)
    return []
  }
}

// Convenience functions for each screener type
export const getBuyScreener = (limit?: number) => getScreenerResults('buy', limit)
export const getSellScreener = (limit?: number) => getScreenerResults('sell', limit)
export const getMomentumScreener = (limit?: number) => getScreenerResults('momentum', limit)
export const getOversoldScreener = (limit?: number) => getScreenerResults('oversold', limit)
export const getBreakoutScreener = (limit?: number) => getScreenerResults('breakout', limit)

// ===== Indicator Endpoints =====

/**
 * Get technical indicators for a specific stock
 */
export async function getStockIndicators(stockCode: string): Promise<StockIndicator | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/signals/indicators/${stockCode}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch stock indicators: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching stock indicators:', error)
    return null
  }
}

/**
 * Get all indicators with pagination
 */
export async function getAllIndicators(
  page = 1,
  limit = 20
): Promise<PaginatedResponse<StockIndicator>> {
  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/signals/indicators?page=${page}&limit=${limit}`
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch indicators: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching indicators:', error)
    return {
      data: [],
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
    }
  }
}

// ===== Combined Data Fetching =====

/**
 * Fetch all signals data for the dashboard
 */
export async function fetchSignalsDashboardData() {
  try {
    const [stats, topSignals, strategies] = await Promise.all([
      getSignalStats(),
      getTopSignals(),
      getStrategies(),
    ])

    return {
      stats,
      topSignals,
      strategies,
      success: true,
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return {
      stats: null,
      topSignals: null,
      strategies: [],
      success: false,
    }
  }
}
