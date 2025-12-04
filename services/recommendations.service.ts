import { getDatabase, ref, set, get, push, update, query, orderByChild, equalTo } from 'firebase/database'
import { database } from '@/lib/firebaseClient'

export interface BuyRecommendation {
  id?: string
  symbol: string
  recommendedPrice: number
  currentPrice: number
  targetPrice?: number
  stopLoss?: number
  confidence: number
  aiSignal: string
  technicalAnalysis: string[]
  fundamentalAnalysis: string[]
  risks: string[]
  opportunities: string[]
  status: 'active' | 'completed' | 'stopped'
  createdAt: string
  updatedAt: string
  completedAt?: string
  gainLoss?: number
  gainLossPercent?: number
}

export interface PerformanceMetrics {
  totalRecommendations: number
  activeRecommendations: number
  completedRecommendations: number
  stoppedRecommendations: number
  winRate: number
  averageGain: number
  averageLoss: number
  totalGainLoss: number
  bestPerformer: {
    symbol: string
    gainLossPercent: number
  } | null
  worstPerformer: {
    symbol: string
    gainLossPercent: number
  } | null
}

/**
 * Get all buy recommendations with optional status filter
 */
export async function getBuyRecommendations(
  status?: 'active' | 'completed' | 'stopped'
): Promise<BuyRecommendation[]> {
  try {
    const recommendationsRef = ref(database, 'buyRecommendations')

    let snapshot
    if (status) {
      const statusQuery = query(recommendationsRef, orderByChild('status'), equalTo(status))
      snapshot = await get(statusQuery)
    } else {
      snapshot = await get(recommendationsRef)
    }

    if (!snapshot.exists()) {
      return []
    }

    const data = snapshot.val()
    const recommendations: BuyRecommendation[] = []

    Object.keys(data).forEach(key => {
      recommendations.push({
        id: key,
        ...data[key]
      })
    })

    // Sort by created date (newest first)
    recommendations.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return recommendations
  } catch (error) {
    console.error('Error fetching buy recommendations:', error)
    throw error
  }
}

/**
 * Save a new buy recommendation
 */
export async function saveBuyRecommendation(
  recommendation: Omit<BuyRecommendation, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const recommendationsRef = ref(database, 'buyRecommendations')
    const newRecRef = push(recommendationsRef)

    const newRecommendation: Omit<BuyRecommendation, 'id'> = {
      ...recommendation,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await set(newRecRef, newRecommendation)

    return newRecRef.key || ''
  } catch (error) {
    console.error('Error saving buy recommendation:', error)
    throw error
  }
}

/**
 * Update recommendation status and current price
 */
export async function updateRecommendationStatus(
  id: string,
  currentPrice: number,
  status?: 'active' | 'completed' | 'stopped'
): Promise<void> {
  try {
    const recRef = ref(database, `buyRecommendations/${id}`)
    const snapshot = await get(recRef)

    if (!snapshot.exists()) {
      throw new Error('Recommendation not found')
    }

    const recommendation = snapshot.val() as BuyRecommendation
    const gainLoss = currentPrice - recommendation.recommendedPrice
    const gainLossPercent = (gainLoss / recommendation.recommendedPrice) * 100

    const updates: Partial<BuyRecommendation> = {
      currentPrice,
      gainLoss,
      gainLossPercent,
      updatedAt: new Date().toISOString(),
    }

    if (status) {
      updates.status = status
      if (status === 'completed' || status === 'stopped') {
        updates.completedAt = new Date().toISOString()
      }
    }

    await update(recRef, updates)
  } catch (error) {
    console.error('Error updating recommendation:', error)
    throw error
  }
}

/**
 * Calculate performance metrics for all recommendations
 */
export async function calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
  try {
    const allRecommendations = await getBuyRecommendations()

    const activeRecs = allRecommendations.filter(r => r.status === 'active')
    const completedRecs = allRecommendations.filter(r => r.status === 'completed')
    const stoppedRecs = allRecommendations.filter(r => r.status === 'stopped')

    const closedRecs = [...completedRecs, ...stoppedRecs]
    const wins = closedRecs.filter(r => (r.gainLossPercent || 0) > 0)
    const losses = closedRecs.filter(r => (r.gainLossPercent || 0) <= 0)

    const winRate = closedRecs.length > 0
      ? (wins.length / closedRecs.length) * 100
      : 0

    const averageGain = wins.length > 0
      ? wins.reduce((sum, r) => sum + (r.gainLossPercent || 0), 0) / wins.length
      : 0

    const averageLoss = losses.length > 0
      ? losses.reduce((sum, r) => sum + (r.gainLossPercent || 0), 0) / losses.length
      : 0

    const totalGainLoss = closedRecs.reduce((sum, r) => sum + (r.gainLossPercent || 0), 0)

    // Find best and worst performers
    let bestPerformer = null
    let worstPerformer = null

    if (closedRecs.length > 0) {
      const sorted = [...closedRecs].sort((a, b) =>
        (b.gainLossPercent || 0) - (a.gainLossPercent || 0)
      )

      bestPerformer = {
        symbol: sorted[0].symbol,
        gainLossPercent: sorted[0].gainLossPercent || 0
      }

      worstPerformer = {
        symbol: sorted[sorted.length - 1].symbol,
        gainLossPercent: sorted[sorted.length - 1].gainLossPercent || 0
      }
    }

    return {
      totalRecommendations: allRecommendations.length,
      activeRecommendations: activeRecs.length,
      completedRecommendations: completedRecs.length,
      stoppedRecommendations: stoppedRecs.length,
      winRate,
      averageGain,
      averageLoss,
      totalGainLoss,
      bestPerformer,
      worstPerformer,
    }
  } catch (error) {
    console.error('Error calculating performance metrics:', error)
    throw error
  }
}

/**
 * Update all active recommendations with current market prices
 * Note: This is a placeholder - in production, you'd fetch actual prices from market API
 */
export async function updateAllRecommendationsWithCurrentPrices(): Promise<void> {
  try {
    const activeRecs = await getBuyRecommendations('active')

    // TODO: Fetch current prices from VNDirect or other market API
    // For now, we'll just update the updatedAt timestamp
    for (const rec of activeRecs) {
      if (rec.id) {
        await updateRecommendationStatus(rec.id, rec.currentPrice)
      }
    }
  } catch (error) {
    console.error('Error updating recommendation prices:', error)
    throw error
  }
}
