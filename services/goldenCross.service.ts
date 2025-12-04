import { getDatabase, ref, get, Database } from 'firebase/database'
import { initializeApp, getApps, FirebaseApp } from 'firebase/app'

export interface GoldenCrossStock {
  ticker: string
  name?: string
  price?: number
  avgNmValue?: number
  ma10?: number
  ma30?: number
  macdv?: number
  note?: string
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
 * Fetch all stocks from Firebase /goldenCross path (raw data, no transformation)
 * @returns Array of all stocks from Firebase
 */
export async function getGoldenCrossStocks(): Promise<GoldenCrossStock[]> {
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

    // Convert Firebase object to array (keep original structure)
    if (typeof data === 'object') {
      for (const key in data) {
        const stock = data[key]
        if (stock && typeof stock === 'object') {
          stocks.push({
            ticker: stock.ticker || key,
            name: stock.name,
            price: stock.price,
            avgNmValue: stock.avgNmValue,
            ma10: stock.ma10,
            ma30: stock.ma30,
            macdv: stock.macdv,
            note: stock.note,
            volume: stock.volume,
            marketCap: stock.marketCap,
            sector: stock.sector,
            lastUpdated: stock.lastUpdated,
          })
        }
      }
    }

    console.log(`Found ${stocks.length} stocks from Firebase /goldenCross`)

    // Return all stocks as-is from Firebase
    return stocks
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
      price: data.price,
      avgNmValue: data.avgNmValue,
      ma10: data.ma10,
      ma30: data.ma30,
      macdv: data.macdv,
      note: data.note,
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
  averageMA10: number
  averageMA30: number
  sectors: Record<string, number>
}> {
  try {
    const stocks = await getGoldenCrossStocks()

    const stats = {
      totalStocks: stocks.length,
      averageMA10: 0,
      averageMA30: 0,
      sectors: {} as Record<string, number>,
    }

    if (stocks.length === 0) {
      return stats
    }

    let ma10Sum = 0
    let ma30Sum = 0
    let ma10Count = 0
    let ma30Count = 0

    stocks.forEach(stock => {
      if (stock.ma10) {
        ma10Sum += stock.ma10
        ma10Count++
      }
      if (stock.ma30) {
        ma30Sum += stock.ma30
        ma30Count++
      }
      if (stock.sector) {
        stats.sectors[stock.sector] = (stats.sectors[stock.sector] || 0) + 1
      }
    })

    stats.averageMA10 = ma10Count > 0 ? ma10Sum / ma10Count : 0
    stats.averageMA30 = ma30Count > 0 ? ma30Sum / ma30Count : 0

    return stats
  } catch (error) {
    console.error('Error calculating golden cross stats:', error)
    throw error
  }
}
