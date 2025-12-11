/**
 * Gemini Module - Central exports
 *
 * Usage:
 * import { geminiHub, geminiAlpha, geminiDeepAnalysis } from '@/lib/gemini'
 */

// Core Hub
export { geminiHub } from './hub'

// Services
export { geminiAlpha } from './alpha'
export { geminiDeepAnalysis } from './deep-analysis'

// Models & Config
export {
  DEFAULT_GEMINI_MODEL,
  GEMINI_API_BASE,
  GEMINI_MODELS,
  getActiveModels,
  getModelById,
  getValidatedModel,
  isValidModel,
} from './models'

// Parsers
export {
  parseSignalResponse,
  parseDeepAnalysisResponse,
  normalizeSignal,
  normalizeConfidence,
  formatPriceValue,
  normalizeArray,
} from './parser'

// Types
export type {
  GeminiModel,
  Signal,
  AnalysisResult,
  DeepAnalysisResult,
  DeepAnalysisRequest,
  AlphaResponse,
  MarketSignalRequest,
} from './types'
