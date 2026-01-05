// ============================================================================
// Signal Service - Adapter for Golden Cross signals
// Following Clean Architecture: Application Layer
// ============================================================================

import { getGoldenCrossStocks } from './goldenCross.service'

// ============================================================================
// Types
// ============================================================================

export interface SignalData {
  ticker: string
  price: number
  ma30: number
  timeCross: string
  type?: string
}

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Safely extract timestamp from signal data
 */
function extractTimestamp(item: any): string {
  if (item.crossDate) return item.crossDate
  if (item.timeCross) return item.timeCross
  if (item.timestamp) return new Date(item.timestamp).toISOString()
  return new Date().toISOString()
}

/**
 * Convert raw Firebase signal data to SignalData format
 */
function transformSignalData(key: string, item: any): SignalData {
  return {
    ticker: key,
    price: Number(item.price) || 0,
    ma30: Number(item.ma30) || 0,
    timeCross: extractTimestamp(item),
    type: 'Golden Cross',
  }
}

/**
 * Sort signals by time (newest first)
 */
function sortSignalsByTime(signals: SignalData[]): SignalData[] {
  return signals.sort((a, b) => {
    const timeA = new Date(a.timeCross).getTime() || 0
    const timeB = new Date(b.timeCross).getTime() || 0
    return timeB - timeA
  })
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch and transform Golden Cross signals for the trading bot
 * This is an adapter that connects raw Firebase data to the bot's interface
 * 
 * @returns Array of up to 30 most recent Golden Cross signals
 */
export async function fetchGoldenCrossSignals(): Promise<SignalData[]> {
  try {
    const rawData = await getGoldenCrossStocks()

    if (!rawData || typeof rawData !== 'object') {
      console.warn('⚠️ No Golden Cross data available')
      return []
    }

    // Transform object to array
    const signalsArray = Object.keys(rawData).map(key =>
      transformSignalData(key, rawData[key])
    )

    // Sort by time (newest first)
    const sortedSignals = sortSignalsByTime(signalsArray)

    // Return top 30 signals
    return sortedSignals.slice(0, 30)
  } catch (error) {
    console.error('❌ Error processing Golden Cross signals:', error)
    return []
  }
}
