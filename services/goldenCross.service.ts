// ============================================================================
// Types
// ============================================================================

export interface GoldenCrossStock {
  [key: string]: any
}

// ============================================================================
// Firebase Configuration
// ============================================================================

/**
 * Get Firebase configuration from environment variables
 * @throws Error if credentials are missing
 */
function getFirebaseConfig(): { baseUrl: string; secret: string } {
  const baseUrl = process.env.FIREBASE_URL
  const secret = process.env.FIREBASE_SECRET

  if (!baseUrl || !secret) {
    console.error('❌ Missing FIREBASE_URL or FIREBASE_SECRET in environment')
    throw new Error('Firebase credentials missing')
  }

  return { baseUrl, secret }
}

/**
 * Build Firebase REST API URL
 */
function buildFirebaseUrl(path: string): string {
  const { baseUrl, secret } = getFirebaseConfig()
  return `${baseUrl}${path}.json?auth=${secret}`
}

// ============================================================================
// Firebase Fetch Utilities
// ============================================================================

/**
 * Fetch data from Firebase with error handling
 */
async function fetchFirebase(url: string): Promise<any> {
  const response = await fetch(url)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Firebase fetch failed:', response.status, errorText)
    throw new Error(`Failed to fetch Firebase data: ${response.status}`)
  }

  return await response.json()
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch all Golden Cross stocks from Firebase Realtime Database
 * @returns Object with stock data keyed by ticker symbol
 * @throws Error if Firebase credentials are missing or fetch fails
 */
export async function getGoldenCrossStocks(): Promise<any> {
  const url = buildFirebaseUrl('/goldenCross')
  return await fetchFirebase(url)
}

/**
 * Fetch specific Golden Cross stock data by ticker
 * @param ticker - Stock ticker symbol
 * @returns Stock data or null if not found
 * @throws Error if Firebase credentials are missing
 */
export async function getGoldenCrossStock(ticker: string): Promise<any> {
  try {
    const url = buildFirebaseUrl(`/goldenCross/${ticker}`)
    return await fetchFirebase(url)
  } catch (error) {
    // Return null for 404 errors (stock not found)
    if (error instanceof Error && error.message.includes('404')) {
      return null
    }
    throw error
  }
}
