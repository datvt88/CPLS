import { database } from '@/lib/firebaseClient'
import { ref, get, set, push, query, orderByChild, equalTo, update } from 'firebase/database'

export interface GoldenCrossStock {
  symbol: string
  date: string
  ma10: number
  ma30: number
  price: number
  volume: number
  crossDate?: string
}

export interface StockRecommendation {
  id?: string
  symbol: string
  recommendedPrice: number
  currentPrice: number
  targetPrice?: string
  stopLoss?: string
  confidence: number
  aiSignal: 'MUA' | 'BÁN' | 'NẮM GIỮ'
  technicalAnalysis: string[]
  fundamentalAnalysis: string[]
  risks: string[]
  opportunities: string[]
  createdAt: string
  status: 'active' | 'completed' | 'stopped'
}

export interface PerformanceMetrics {
  totalRecommendations: number
  profitableCount: number
  lossCount: number
  avgReturn: number
  bestReturn: number
  worstReturn: number
  winRate: number
}

/**
 * Fetch golden cross stocks from Firebase
 */
export async function getGoldenCrossStocks(): Promise<GoldenCrossStock[]> {
  try {
    const goldenCrossRef = ref(database, 'goldenCross')
    const snapshot = await get(goldenCrossRef)

    if (!snapshot.exists()) {
      console.log('No golden cross data found in Firebase')
      return []
    }

    const data = snapshot.val()
    const stocks: GoldenCrossStock[] = []

    Object.keys(data).forEach(symbol => {
      const stockData = data[symbol]
      if (stockData && typeof stockData === 'object') {
        stocks.push({
          symbol,
          date: stockData.date || new Date().toISOString(),
          ma10: stockData.ma10 || 0,
          ma30: stockData.ma30 || 0,
          price: stockData.price || 0,
          volume: stockData.volume || 0,
          crossDate: stockData.crossDate
        })
      }
    })

    // Sort by date descending (newest first)
    stocks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    console.log(`📊 Fetched ${stocks.length} golden cross stocks from Firebase`)
    return stocks
  } catch (error) {
    console.error('Error fetching golden cross stocks:', error)
    throw error
  }
}

/**
 * Save a buy recommendation to Firebase
 */
export async function saveBuyRecommendation(recommendation: Omit<StockRecommendation, 'id' | 'createdAt' | 'status'>): Promise<string> {
  try {
    const recommendationsRef = ref(database, 'buyRecommendations')
    const newRecommendationRef = push(recommendationsRef)

    const fullRecommendation: StockRecommendation = {
      ...recommendation,
      createdAt: new Date().toISOString(),
      status: 'active'
    }

    await set(newRecommendationRef, fullRecommendation)

    const id = newRecommendationRef.key || ''
    console.log(`✅ Saved buy recommendation for ${recommendation.symbol} with ID: ${id}`)
    return id
  } catch (error) {
    console.error('Error saving buy recommendation:', error)
    throw error
  }
}

/**
 * Get all buy recommendations
 */
export async function getBuyRecommendations(status?: 'active' | 'completed' | 'stopped'): Promise<StockRecommendation[]> {
  try {
    const recommendationsRef = ref(database, 'buyRecommendations')
    let recommendationsQuery = recommendationsRef

    if (status) {
      recommendationsQuery = query(recommendationsRef, orderByChild('status'), equalTo(status))
    }

    const snapshot = await get(recommendationsQuery)

    if (!snapshot.exists()) {
      console.log('No buy recommendations found')
      return []
    }

    const data = snapshot.val()
    const recommendations: StockRecommendation[] = []

    Object.keys(data).forEach(key => {
      const rec = data[key]
      recommendations.push({
        id: key,
        ...rec
      })
    })

    // Sort by created date descending
    recommendations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    console.log(`📊 Fetched ${recommendations.length} buy recommendations`)
    return recommendations
  } catch (error) {
    console.error('Error fetching buy recommendations:', error)
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
    const recommendationRef = ref(database, `buyRecommendations/${id}`)
    const updates: any = {
      currentPrice,
      lastUpdated: new Date().toISOString()
    }

    if (status) {
      updates.status = status
    }

    await update(recommendationRef, updates)
    console.log(`✅ Updated recommendation ${id}`)
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
    const recommendations = await getBuyRecommendations()

    if (recommendations.length === 0) {
      return {
        totalRecommendations: 0,
        profitableCount: 0,
        lossCount: 0,
        avgReturn: 0,
        bestReturn: 0,
        worstReturn: 0,
        winRate: 0
      }
    }

    let profitableCount = 0
    let lossCount = 0
    let totalReturn = 0
    let bestReturn = -Infinity
    let worstReturn = Infinity

    recommendations.forEach(rec => {
      const returnPercent = ((rec.currentPrice - rec.recommendedPrice) / rec.recommendedPrice) * 100
      totalReturn += returnPercent

      if (returnPercent > 0) {
        profitableCount++
      } else if (returnPercent < 0) {
        lossCount++
      }

      if (returnPercent > bestReturn) {
        bestReturn = returnPercent
      }

      if (returnPercent < worstReturn) {
        worstReturn = returnPercent
      }
    })

    const avgReturn = totalReturn / recommendations.length
    const winRate = (profitableCount / recommendations.length) * 100

    return {
      totalRecommendations: recommendations.length,
      profitableCount,
      lossCount,
      avgReturn,
      bestReturn: bestReturn === -Infinity ? 0 : bestReturn,
      worstReturn: worstReturn === Infinity ? 0 : worstReturn,
      winRate
    }
  } catch (error) {
    console.error('Error calculating performance metrics:', error)
    throw error
  }
}

/**
 * Update all active recommendations with current market prices
 */
export async function updateAllRecommendationsWithCurrentPrices(): Promise<void> {
  try {
    const activeRecommendations = await getBuyRecommendations('active')

    console.log(`Updating ${activeRecommendations.length} active recommendations with current prices`)

    const updatePromises = activeRecommendations.map(async rec => {
      try {
        // Fetch current price from VNDirect API
        const response = await fetch(`/api/vndirect/prices?symbol=${rec.symbol}&days=1`)

        if (!response.ok) {
          console.warn(`Failed to fetch price for ${rec.symbol}`)
          return
        }

        const data = await response.json()

        if (data.data && data.data.length > 0) {
          const currentPrice = data.data[0].adClose

          // Auto-update status if stop loss or target reached
          let newStatus: 'active' | 'completed' | 'stopped' = rec.status

          if (rec.stopLoss) {
            const stopLossPrice = parseFloat(rec.stopLoss.replace(/,/g, ''))
            if (currentPrice <= stopLossPrice) {
              newStatus = 'stopped'
            }
          }

          if (rec.targetPrice) {
            const targetPrice = parseFloat(rec.targetPrice.replace(/,/g, '').split('-')[0])
            if (currentPrice >= targetPrice) {
              newStatus = 'completed'
            }
          }

          await updateRecommendationStatus(rec.id!, currentPrice, newStatus)
        }
      } catch (error) {
        console.error(`Error updating price for ${rec.symbol}:`, error)
      }
    })

    await Promise.all(updatePromises)
    console.log('✅ Finished updating all active recommendations')
  } catch (error) {
    console.error('Error updating recommendations with current prices:', error)
    throw error
  }
}
