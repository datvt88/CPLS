import { getDatabase, ref, get, Database } from 'firebase/database'
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'

export interface GoldenCrossStock {
  ticker: string
  name?: string
  crossDate?: string
  ma50?: number
  ma200?: number
  price?: number
  volume?: number
  marketCap?: number
  sector?: string
  lastUpdated?: string
}

let goldenCrossApp: FirebaseApp | null = null
let goldenCrossDatabase: Database | null = null

/**
 * Initialize Firebase app for Golden Cross data
 * Uses FIREBASE_URL and FIREBASE_SECRET from environment variables
 */
function initGoldenCrossFirebase(): Database {
  if (goldenCrossDatabase) {
    return goldenCrossDatabase
  }

  const firebaseUrl = process.env.FIREBASE_URL || process.env.NEXT_PUBLIC_FIREBASE_URL
  const firebaseSecret = process.env.FIREBASE_SECRET

  if (!firebaseUrl) {
    throw new Error('FIREBASE_URL is not configured')
  }

  // Check if app already exists
  const existingApps = getApps()
  const existingApp = existingApps.find(app => app.name === 'golden-cross-db')

  if (existingApp) {
    goldenCrossApp = existingApp
  } else {
    // Initialize new Firebase app for Golden Cross data
    const config: any = {
      databaseURL: firebaseUrl,
    }

    // If secret is provided, it will be used for authentication
    if (firebaseSecret) {
      config.databaseAuthVariableOverride = {
        uid: 'golden-cross-service',
      }
    }

    goldenCrossApp = initializeApp(config, 'golden-cross-db')
  }

  goldenCrossDatabase = getDatabase(goldenCrossApp)
  return goldenCrossDatabase
}

/**
 * Fetch list of stocks with Golden Cross signal from Firebase
 * @param limit - Maximum number of stocks to return
 * @returns Array of Golden Cross stocks
 */
export async function getGoldenCrossStocks(limit: number = 50): Promise<GoldenCrossStock[]> {
  try {
    const database = initGoldenCrossFirebase()
    const goldenCrossRef = ref(database, 'goldenCross')

    const snapshot = await get(goldenCrossRef)

    if (!snapshot.exists()) {
      console.log('No golden cross data found in Firebase')
      return []
    }

    const data = snapshot.val()
    const stocks: GoldenCrossStock[] = []

    // Convert Firebase object to array
    if (typeof data === 'object') {
      for (const key in data) {
        const stock = data[key]
        if (stock && typeof stock === 'object') {
          stocks.push({
            ticker: stock.ticker || key,
            name: stock.name,
            crossDate: stock.crossDate,
            ma50: stock.ma50,
            ma200: stock.ma200,
            price: stock.price,
            volume: stock.volume,
            marketCap: stock.marketCap,
            sector: stock.sector,
            lastUpdated: stock.lastUpdated,
          })
        }
      }
    }

    // Sort by cross date (most recent first)
    stocks.sort((a, b) => {
      const dateA = a.crossDate ? new Date(a.crossDate).getTime() : 0
      const dateB = b.crossDate ? new Date(b.crossDate).getTime() : 0
      return dateB - dateA
    })

    // Return limited results
    return stocks.slice(0, limit)
  } catch (error) {
    console.error('Error fetching golden cross stocks from Firebase:', error)
    throw error
  }
}

/**
 * Fetch a specific stock's Golden Cross data
 * @param ticker - Stock ticker symbol
 * @returns Golden Cross stock data or null if not found
 */
export async function getGoldenCrossStock(ticker: string): Promise<GoldenCrossStock | null> {
  try {
    const database = initGoldenCrossFirebase()
    const stockRef = ref(database, `goldenCross/${ticker}`)

    const snapshot = await get(stockRef)

    if (!snapshot.exists()) {
      return null
    }

    const data = snapshot.val()
    return {
      ticker: data.ticker || ticker,
      name: data.name,
      crossDate: data.crossDate,
      ma50: data.ma50,
      ma200: data.ma200,
      price: data.price,
      volume: data.volume,
      marketCap: data.marketCap,
      sector: data.sector,
      lastUpdated: data.lastUpdated,
    }
  } catch (error) {
    console.error(`Error fetching golden cross data for ${ticker}:`, error)
    return null
  }
}

/**
 * Get statistics about Golden Cross stocks
 */
export async function getGoldenCrossStats(): Promise<{
  totalStocks: number
  averageMA50: number
  averageMA200: number
  sectors: Record<string, number>
}> {
  try {
    const stocks = await getGoldenCrossStocks(1000)

    const stats = {
      totalStocks: stocks.length,
      averageMA50: 0,
      averageMA200: 0,
      sectors: {} as Record<string, number>,
    }

    if (stocks.length === 0) {
      return stats
    }

    let ma50Sum = 0
    let ma200Sum = 0
    let ma50Count = 0
    let ma200Count = 0

    stocks.forEach(stock => {
      if (stock.ma50) {
        ma50Sum += stock.ma50
        ma50Count++
      }
      if (stock.ma200) {
        ma200Sum += stock.ma200
        ma200Count++
      }
      if (stock.sector) {
        stats.sectors[stock.sector] = (stats.sectors[stock.sector] || 0) + 1
      }
    })

    stats.averageMA50 = ma50Count > 0 ? ma50Sum / ma50Count : 0
    stats.averageMA200 = ma200Count > 0 ? ma200Sum / ma200Count : 0

    return stats
  } catch (error) {
    console.error('Error calculating golden cross stats:', error)
    throw error
  }
}
