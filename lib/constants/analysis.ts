/**
 * Analysis constants for stock evaluation
 * Centralized configuration for technical and fundamental analysis
 */

// === FETCHING CONFIGURATION ===
export const FETCH_CONFIG = {
  /** Number of trading sessions to fetch for short-term analysis (~6 months) */
  SHORT_TERM_SESSIONS: 150,
  /** Number of trading sessions to fetch for long-term Gemini analysis (~1 year) */
  LONG_TERM_SESSIONS: 300,
  /** Minimum sessions required for analysis */
  MIN_SESSIONS: 30,
} as const

// === TECHNICAL INDICATORS ===
export const TECHNICAL_INDICATORS = {
  /** Moving average periods */
  MA_SHORT_PERIOD: 10,
  MA_LONG_PERIOD: 30,

  /** Bollinger Bands configuration */
  BB_PERIOD: 20,
  BB_STD_DEV: 2,

  /** Volume analysis */
  VOLUME_AVG_PERIOD: 10,
} as const

// === ANALYSIS WEIGHTS (Short-term Technical) ===
export const SHORT_TERM_WEIGHTS = {
  MOVING_AVERAGE: 30,
  BOLLINGER_BANDS: 25,
  PRICE_MOMENTUM: 20,
  VOLUME: 15,
  HISTORICAL_POSITION: 10,
} as const

// === ANALYSIS WEIGHTS (Long-term Fundamental) ===
export const LONG_TERM_WEIGHTS = {
  PE_RATIO: 25,
  PB_RATIO: 20,
  ROE: 25,
  DIVIDEND_YIELD: 15,
  MARKET_CAP: 10,
  FREE_FLOAT: 5,
} as const

// === SIGNAL THRESHOLDS ===
export const SIGNAL_THRESHOLDS = {
  /** Net score > this value = BUY signal */
  BUY_THRESHOLD: 15,
  /** Net score < this value = SELL signal */
  SELL_THRESHOLD: -15,
  /** Between thresholds = HOLD */

  /** MA difference percentage for strong trend */
  MA_STRONG_TREND: 2,

  /** Bollinger Bands position thresholds */
  BB_OVERSOLD: 0.2,  // <= 20% = oversold, potential buy
  BB_OVERBOUGHT: 0.8, // >= 80% = overbought, potential sell
  BB_SUPPORT: 0.4,    // < 40% = support zone
  BB_RESISTANCE: 0.6, // > 60% = resistance zone

  /** Price momentum thresholds */
  MOMENTUM_5D_STRONG: 3,   // +3% in 5 days
  MOMENTUM_10D_STRONG: 5,  // +5% in 10 days

  /** Volume thresholds */
  VOLUME_HIGH: 1.5,  // 150% of average
  VOLUME_LOW: 0.7,   // 70% of average

  /** Historical position thresholds */
  HISTORICAL_BOTTOM: 0.3, // < 30% = near bottom
  HISTORICAL_TOP: 0.7,    // > 70% = near top
} as const

// === FUNDAMENTAL THRESHOLDS ===
export const FUNDAMENTAL_THRESHOLDS = {
  /** P/E Ratio */
  PE_VERY_LOW: 10,
  PE_REASONABLE_MAX: 20,
  PE_HIGH: 30,

  /** P/B Ratio */
  PB_UNDERVALUED: 1,
  PB_REASONABLE_MAX: 2,
  PB_HIGH: 3,

  /** ROE (as percentage) */
  ROE_EXCELLENT: 20,
  ROE_GOOD_MIN: 15,
  ROE_AVERAGE_MIN: 10,

  /** Dividend Yield (as percentage) */
  DIVIDEND_HIGH: 5,
  DIVIDEND_GOOD_MIN: 3,

  /** Market Cap (VND) */
  MARKET_CAP_LARGE: 10_000_000_000_000, // 10 trillion VND
  MARKET_CAP_MEDIUM: 1_000_000_000_000,  // 1 trillion VND

  /** Free Float (as percentage) */
  FREE_FLOAT_HIGH: 30,
  FREE_FLOAT_LOW: 15,
} as const

// === TRADING CONFIGURATION ===
export const TRADING_CONFIG = {
  /** Cut loss percentage below current price */
  CUT_LOSS_PERCENTAGE: 0.965, // -3.5%

  /** Minimum data weight for reliable long-term analysis */
  MIN_FUNDAMENTAL_WEIGHT: 50,
} as const

// === MOMENTUM ANALYSIS ===
export const MOMENTUM_CONFIG = {
  /** Days for momentum calculation */
  SHORT_PERIOD: 5,
  LONG_PERIOD: 10,

  /** Minimum data required */
  MIN_DATA_FOR_LONG: 11,  // Need 11 sessions for 10-day momentum
  MIN_DATA_FOR_SHORT: 6,  // Need 6 sessions for 5-day momentum
} as const
