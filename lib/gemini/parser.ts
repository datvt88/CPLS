/**
 * Gemini Response Parser
 * Utilities for parsing and normalizing Gemini API responses
 */

import type { Signal, AnalysisResult, DeepAnalysisResult } from './types'

/**
 * Parse simple signal response from Gemini
 */
export function parseSignalResponse(text: string): AnalysisResult {
  const m = text.match(/\{[\s\S]*\}/)
  if (m) {
    try {
      const parsed = JSON.parse(m[0])
      return {
        signal: normalizeSignal(parsed.signal),
        confidence: normalizeConfidence(parsed.confidence),
        summary: String(parsed.summary || '').slice(0, 500)
      }
    } catch {}
  }

  // Fallback to keyword matching
  if (/BUY|MUA/i.test(text)) return { signal: 'MUA', confidence: 50, summary: text.slice(0, 300) }
  if (/SELL|BÁN/i.test(text)) return { signal: 'BÁN', confidence: 50, summary: text.slice(0, 300) }
  return { signal: 'THEO DÕI', confidence: 50, summary: text.slice(0, 300) }
}

/**
 * Parse deep analysis response from Gemini
 */
export function parseDeepAnalysisResponse(text: string, currentPrice?: number): DeepAnalysisResult {
  // Clean markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Find JSON object
  const startIdx = cleaned.indexOf('{')
  if (startIdx === -1) {
    return createDefaultDeepAnalysis(currentPrice)
  }

  // Find matching closing brace
  let braceCount = 0
  let endIdx = -1
  for (let i = startIdx; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceCount++
    if (cleaned[i] === '}') braceCount--
    if (braceCount === 0) {
      endIdx = i
      break
    }
  }

  if (endIdx === -1) {
    return createDefaultDeepAnalysis(currentPrice)
  }

  const jsonStr = cleaned.substring(startIdx, endIdx + 1)

  try {
    // Fix common JSON issues
    let fixedJson = jsonStr
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/"null"/gi, 'null')
      .replace(/"undefined"/gi, 'null')

    const parsed = JSON.parse(fixedJson)
    return normalizeDeepAnalysis(parsed, currentPrice)
  } catch {
    return createDefaultDeepAnalysis(currentPrice)
  }
}

/**
 * Normalize signal value
 */
export function normalizeSignal(signal: any): Signal {
  if (!signal) return 'THEO DÕI'
  const s = String(signal).toUpperCase().trim()

  if (s.includes('MUA') || s.includes('BUY')) return 'MUA'
  if (s.includes('BÁN') || s.includes('SELL')) return 'BÁN'
  return 'THEO DÕI'
}

/**
 * Normalize confidence value
 */
export function normalizeConfidence(confidence: any): number {
  const num = Number(confidence)
  if (isNaN(num)) return 50
  return Math.max(0, Math.min(100, Math.round(num)))
}

/**
 * Parse price value to number
 */
export function parsePriceValue(price: any): number | null {
  if (price === null || price === undefined || price === 'null') return null

  const num = Number(price)
  if (isNaN(num)) return null

  // If too small, multiply by 1000 (assuming x1000 VND format)
  return num < 1000 ? num * 1000 : num
}

/**
 * Format price value (for display - legacy support)
 */
export function formatPriceValue(price: any): string | null {
  const num = parsePriceValue(price)
  if (num === null) return null

  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })
}

/**
 * Normalize array to exactly n items
 */
export function normalizeArray(arr: any, count: number, defaults: string[]): string[] {
  const result: string[] = []

  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (item && typeof item === 'string' && item.trim().length > 3) {
        result.push(item.trim())
        if (result.length >= count) break
      }
    }
  }

  // Fill with defaults if needed
  let defaultIdx = 0
  while (result.length < count && defaultIdx < defaults.length) {
    result.push(defaults[defaultIdx])
    defaultIdx++
  }

  return result.slice(0, count)
}

/**
 * Normalize deep analysis response
 */
function normalizeDeepAnalysis(parsed: any, currentPrice?: number): DeepAnalysisResult {
  const result: DeepAnalysisResult = {
    shortTerm: {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Không đủ dữ liệu phân tích ngắn hạn.',
      reasons: []
    },
    longTerm: {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Không đủ dữ liệu phân tích dài hạn.',
      reasons: []
    },
    buyPrice: null,
    targetPrice: null,
    stopLoss: null,
    risks: [],
    opportunities: [],
    timestamp: Date.now()
  }

  // Normalize shortTerm
  if (parsed.shortTerm) {
    result.shortTerm = {
      signal: normalizeSignal(parsed.shortTerm.signal),
      confidence: normalizeConfidence(parsed.shortTerm.confidence),
      summary: String(parsed.shortTerm.summary || '').trim() || 'Phân tích kỹ thuật cho thấy cần theo dõi thêm các chỉ báo.',
      reasons: Array.isArray(parsed.shortTerm.reasons) ? parsed.shortTerm.reasons.filter((r: any) => typeof r === 'string') : []
    }
  }

  // Normalize longTerm
  if (parsed.longTerm) {
    result.longTerm = {
      signal: normalizeSignal(parsed.longTerm.signal),
      confidence: normalizeConfidence(parsed.longTerm.confidence),
      summary: String(parsed.longTerm.summary || '').trim() || 'Phân tích cơ bản cho thấy cần theo dõi các chỉ số tài chính.',
      reasons: Array.isArray(parsed.longTerm.reasons) ? parsed.longTerm.reasons.filter((r: any) => typeof r === 'string') : []
    }
  }

  // Check if any signal is MUA
  const hasBuySignal = result.shortTerm.signal === 'MUA' || result.longTerm.signal === 'MUA'

  // Normalize prices (only if buy signal)
  if (hasBuySignal) {
    result.buyPrice = parsePriceValue(parsed.buyPrice)
    result.targetPrice = parsePriceValue(parsed.targetPrice)
    result.stopLoss = parsePriceValue(parsed.stopLoss)
  }

  // Normalize risks and opportunities (exactly 3 each)
  result.risks = normalizeArray(parsed.risks, 3, [
    'Biến động thị trường có thể ảnh hưởng đến giá',
    'Rủi ro thanh khoản khi giao dịch',
    'Cần theo dõi thêm các chỉ số tài chính'
  ])

  result.opportunities = normalizeArray(parsed.opportunities, 3, [
    'Tiềm năng tăng trưởng từ ngành',
    'Định giá có thể hấp dẫn so với các chỉ số cơ bản',
    'Cơ hội từ xu hướng kỹ thuật'
  ])

  return result
}

/**
 * Create default deep analysis response
 */
function createDefaultDeepAnalysis(currentPrice?: number): DeepAnalysisResult {
  return {
    shortTerm: {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Cần theo dõi thêm các chỉ báo kỹ thuật trước khi đưa ra quyết định.',
      reasons: []
    },
    longTerm: {
      signal: 'THEO DÕI',
      confidence: 50,
      summary: 'Cần phân tích thêm các chỉ số cơ bản để đánh giá dài hạn.',
      reasons: []
    },
    buyPrice: null,
    targetPrice: null,
    stopLoss: null,
    risks: [
      'Biến động thị trường có thể ảnh hưởng đến giá',
      'Rủi ro thanh khoản khi giao dịch',
      'Cần theo dõi thêm các chỉ số tài chính'
    ],
    opportunities: [
      'Tiềm năng tăng trưởng từ ngành',
      'Định giá có thể hấp dẫn so với các chỉ số cơ bản',
      'Cơ hội từ xu hướng kỹ thuật'
    ],
    timestamp: Date.now()
  }
}
