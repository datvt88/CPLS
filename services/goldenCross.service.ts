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
 * Uses environment variables or fallback to default Firebase project
 */
function initGoldenCrossFirebase(): Database {
  if (goldenCrossDatabase) {
    return goldenCrossDatabase
  }

  // Try to use custom Firebase config first
  const customFirebaseUrl = process.env.FIREBASE_URL || process.env.NEXT_PUBLIC_FIREBASE_URL

  // Check if app already exists
  const existingApps = getApps()

  // If custom Firebase URL is provided, use it
  if (customFirebaseUrl) {
    const existingApp = existingApps.find(app => app.name === 'golden-cross-db')

    if (existingApp) {
      goldenCrossApp = existingApp
    } else {
      // Create config with custom URL
      // Note: Firebase SDK requires at least apiKey and projectId
      const config: any = {
        apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDB3e7EIk8cZEtKsEdfZza0hSIAMmvFRQ4', // Fallback to default
        databaseURL: customFirebaseUrl,
        projectId: process.env.FIREBASE_PROJECT_ID || 'wp-realtime-chat-cpls', // Fallback to default
      }

      try {
        goldenCrossApp = initializeApp(config, 'golden-cross-db')
      } catch (error) {
        console.error('Error initializing custom Firebase:', error)
        // Fallback to default app
        goldenCrossApp = existingApps[0] || null
      }
    }
  } else {
    // Use default Firebase app (wp-realtime-chat-cpls)
    console.log('Using default Firebase app for Golden Cross data')
    goldenCrossApp = existingApps[0] || null

    if (!goldenCrossApp) {
      // Initialize default Firebase app
      const defaultConfig = {
        apiKey: 'AIzaSyDB3e7EIk8cZEtKsEdfZza0hSIAMmvFRQ4',
        authDomain: 'wp-realtime-chat-cpls.firebaseapp.com',
        databaseURL: 'https://wp-realtime-chat-cpls-default-rtdb.asia-southeast1.firebasedatabase.app',
        projectId: 'wp-realtime-chat-cpls',
        storageBucket: 'wp-realtime-chat-cpls.appspot.com',
        messagingSenderId: '234321083134',
        appId: '1:234321083134:web:c3b5816f0f5627a80683af',
      }
      goldenCrossApp = initializeApp(defaultConfig)
    }
  }

  if (!goldenCrossApp) {
    throw new Error('Failed to initialize Firebase app for Golden Cross')
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
          // Support both ma50/ma200 and ma10/ma30 from Firebase
          const ma50 = stock.ma50 || stock.ma30 || 0
          const ma200 = stock.ma200 || stock.ma10 || 0

          // Calculate cross date if not provided
          let crossDate = stock.crossDate
          if (!crossDate && ma50 > ma200) {
            crossDate = stock.lastUpdated || new Date().toISOString()
          }

          stocks.push({
            ticker: stock.ticker || key,
            name: stock.name || key,
            crossDate: crossDate,
            ma50: ma50,
            ma200: ma200,
            price: stock.price || stock.avgNmValue || 0,
            volume: stock.volume || 0,
            marketCap: stock.marketCap || 0,
            sector: stock.sector || 'Unknown',
            lastUpdated: stock.lastUpdated || new Date().toISOString(),
          })
        }
      }
    }

    // Filter stocks with Golden Cross (ma10 > ma30)
    // ma10 is fast MA, ma30 is slow MA - Golden Cross when fast > slow
    const goldenCrossStocks = stocks.filter(stock => {
      return stock.ma50 && stock.ma200 && stock.ma200 > stock.ma50
    })

    console.log(`Found ${goldenCrossStocks.length} stocks with Golden Cross (ma10 > ma30) out of ${stocks.length} total`)

    // Sort by cross date (most recent first)
    goldenCrossStocks.sort((a, b) => {
      const dateA = a.crossDate ? new Date(a.crossDate).getTime() : 0
      const dateB = b.crossDate ? new Date(b.crossDate).getTime() : 0
      return dateB - dateA
    })

    // Return limited results
    return goldenCrossStocks.slice(0, limit)
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
