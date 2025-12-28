export type SignalType = 'BUY' | 'SELL' | 'HOLD'

export interface SignalOutput {
  signal: SignalType
  confidence: number
  summary: string
}

export interface SignalError {
  error: string
}

export type SignalResponse = SignalOutput | SignalError

// ===== New Signal API Types =====

// Base signal from API
export interface Signal {
  id: number
  stock_code: string
  signal_type: 'BUY' | 'SELL' | 'HOLD'
  strategy: string
  confidence: number
  entry_price: number
  target_price: number
  stop_loss: number
  potential_gain: number
  potential_loss: number
  risk_reward_ratio: number
  signal_strength: 'strong' | 'medium' | 'weak'
  time_horizon: string
  notes: string
  created_at: string
  updated_at: string
}

// Stock Indicators
export interface StockIndicator {
  stock_code: string
  price: number
  change_percent: number
  volume: number
  avg_volume: number
  volume_ratio: number

  // Moving Averages
  ma5: number
  ma10: number
  ma20: number
  ma50: number
  ma200: number

  // RSI
  rsi_14: number
  rsi_condition: 'overbought' | 'oversold' | 'neutral'

  // MACD
  macd: number
  macd_signal: number
  macd_histogram: number
  macd_trend: 'bullish' | 'bearish' | 'neutral'

  // Bollinger Bands
  bb_upper: number
  bb_middle: number
  bb_lower: number
  bb_position: 'above' | 'middle' | 'below'

  // Trend
  trend_short: 'up' | 'down' | 'sideways'
  trend_medium: 'up' | 'down' | 'sideways'
  trend_long: 'up' | 'down' | 'sideways'

  // Support/Resistance
  support_1: number
  support_2: number
  resistance_1: number
  resistance_2: number

  updated_at: string
}

// Signal Statistics
export interface SignalStats {
  total_signals: number
  buy_signals: number
  sell_signals: number
  hold_signals: number
  strong_signals: number
  medium_signals: number
  weak_signals: number
  avg_confidence: number
  avg_potential_gain: number
  avg_risk_reward: number
  top_strategies: StrategyPerformance[]
  signals_by_day: DailySignalCount[]
  last_updated: string
}

export interface StrategyPerformance {
  strategy: string
  signal_count: number
  avg_confidence: number
  avg_potential_gain: number
}

export interface DailySignalCount {
  date: string
  buy_count: number
  sell_count: number
  total: number
}

// Top Signals Response
export interface TopSignalsResponse {
  top_buy: Signal[]
  top_sell: Signal[]
  most_confident: Signal[]
  highest_potential: Signal[]
}

// Strategy Info
export interface StrategyInfo {
  id: string
  name: string
  description: string
  type: 'momentum' | 'trend' | 'value' | 'technical' | 'hybrid'
  signal_count: number
  avg_accuracy: number
  parameters: Record<string, any>
}

// Screener Results
export interface ScreenerResult {
  stock_code: string
  signal_type: 'BUY' | 'SELL'
  confidence: number
  entry_price: number
  target_price: number
  stop_loss: number
  potential_gain: number
  risk_reward_ratio: number
  strategy: string
  signal_strength: 'strong' | 'medium' | 'weak'
  indicators: {
    rsi: number
    macd_trend: string
    volume_ratio: number
    price_vs_ma20: number
  }
  created_at: string
}

// Paginated Response
export interface PaginatedResponse<T> {
  data: T[]
  page: number
  limit: number
  total: number
  total_pages: number
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Signal Filter options
export interface SignalFilters {
  signal_type?: 'BUY' | 'SELL' | 'HOLD'
  strategy?: string
  min_confidence?: number
  min_potential_gain?: number
  signal_strength?: 'strong' | 'medium' | 'weak'
  stock_code?: string
  page?: number
  limit?: number
}
