import { SignalOutput } from '@/types/signal'

/**
 * Validate if parsed object matches SignalOutput interface
 */
function isValidSignalOutput(obj: any): obj is SignalOutput {
  if (!obj || typeof obj !== 'object') return false

  const validSignals = ['BUY', 'SELL', 'HOLD']
  const hasValidSignal = typeof obj.signal === 'string' && validSignals.includes(obj.signal)
  const hasValidConfidence = typeof obj.confidence === 'number' && obj.confidence >= 0 && obj.confidence <= 100
  const hasValidSummary = typeof obj.summary === 'string' && obj.summary.length > 0

  return hasValidSignal && hasValidConfidence && hasValidSummary
}

/**
 * Extract signal from text using keyword matching
 * More robust than simple regex - checks for context
 */
function extractSignalFromText(text: string): 'BUY' | 'SELL' | 'HOLD' {
  const lowerText = text.toLowerCase()

  // Count occurrences with context
  const buyKeywords = ['mua', 'buy', 'khuyến nghị mua', 'nên mua', 'tích cực']
  const sellKeywords = ['bán', 'sell', 'khuyến nghị bán', 'nên bán', 'tiêu cực']
  const holdKeywords = ['giữ', 'hold', 'nắm giữ', 'chờ', 'trung tính']

  let buyScore = 0
  let sellScore = 0
  let holdScore = 0

  buyKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) buyScore++
  })

  sellKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) sellScore++
  })

  holdKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) holdScore++
  })

  // Determine signal based on highest score
  if (buyScore > sellScore && buyScore > holdScore) return 'BUY'
  if (sellScore > buyScore && sellScore > holdScore) return 'SELL'
  return 'HOLD'
}

/**
 * Parse Gemini API response to SignalOutput
 * Handles JSON and plain text responses with validation
 */
export function parseGeminiResponse(text: string): SignalOutput {
  // Try to extract JSON first
  const jsonMatch = text.match(/\{[\s\S]*?\}/)

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])

      // Validate parsed object
      if (isValidSignalOutput(parsed)) {
        return parsed
      }

      // Try to fix common issues
      if (parsed.signal && parsed.confidence !== undefined && parsed.summary) {
        const signal = parsed.signal.toUpperCase()
        if (['BUY', 'SELL', 'HOLD'].includes(signal)) {
          return {
            signal: signal as 'BUY' | 'SELL' | 'HOLD',
            confidence: Math.max(0, Math.min(100, Number(parsed.confidence))),
            summary: String(parsed.summary)
          }
        }
      }
    } catch (error) {
      console.warn('Failed to parse JSON from Gemini response:', error)
    }
  }

  // Fallback: extract signal from text content
  const signal = extractSignalFromText(text)

  // Extract confidence if mentioned in text
  const confidenceMatch = text.match(/(\d+)%/)
  const confidence = confidenceMatch ? Math.min(100, Math.max(0, parseInt(confidenceMatch[1]))) : 50

  // Create summary (up to 500 chars, try to end at sentence)
  let summary = text.slice(0, 500)
  const lastPeriod = summary.lastIndexOf('.')
  const lastQuestion = summary.lastIndexOf('?')
  const lastExclamation = summary.lastIndexOf('!')
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation)

  if (lastSentenceEnd > 100) {
    summary = text.slice(0, lastSentenceEnd + 1)
  }

  return { signal, confidence, summary }
}
