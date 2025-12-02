import { supabase } from './supabaseClient'

// Cache for permissions to reduce RPC calls
interface PermissionsCache {
  isPremium: { value: boolean; timestamp: number } | null
  features: { value: Feature[]; timestamp: number } | null
}

const cache: PermissionsCache = {
  isPremium: null,
  features: null
}

const CACHE_TTL = 300000 // 5 minutes cache

/**
 * Feature definitions and access levels
 */
export const FEATURES = {
  // Free tier features
  DASHBOARD: 'dashboard',
  STOCKS: 'stocks',
  MARKET: 'market',
  PROFILE: 'profile',

  // Premium only features
  SIGNALS: 'signals',
  AI_ANALYSIS: 'ai-analysis',
  PORTFOLIO: 'portfolio',
  ALERTS: 'alerts',
} as const

export type Feature = typeof FEATURES[keyof typeof FEATURES]

/**
 * Features available for each tier
 */
export const FREE_FEATURES: Feature[] = [
  FEATURES.DASHBOARD,
  FEATURES.STOCKS,
  FEATURES.MARKET,
  FEATURES.PROFILE,
]

export const PREMIUM_FEATURES: Feature[] = [
  FEATURES.SIGNALS,
  FEATURES.AI_ANALYSIS,
  FEATURES.PORTFOLIO,
  FEATURES.ALERTS,
]

export const ALL_FEATURES: Feature[] = [
  ...FREE_FEATURES,
  ...PREMIUM_FEATURES,
]

/**
 * Route to feature mapping
 */
export const ROUTE_FEATURES: Record<string, Feature> = {
  '/dashboard': FEATURES.DASHBOARD,
  '/stocks': FEATURES.STOCKS,
  '/market': FEATURES.MARKET,
  '/profile': FEATURES.PROFILE,
  '/signals': FEATURES.SIGNALS,
  '/ai-analysis': FEATURES.AI_ANALYSIS,
  '/portfolio': FEATURES.PORTFOLIO,
  '/alerts': FEATURES.ALERTS,
}

/**
 * Feature display names (Vietnamese)
 */
export const FEATURE_NAMES: Record<Feature, string> = {
  [FEATURES.DASHBOARD]: 'Tổng quan',
  [FEATURES.STOCKS]: 'Cổ phiếu',
  [FEATURES.MARKET]: 'Thị trường',
  [FEATURES.PROFILE]: 'Cá nhân',
  [FEATURES.SIGNALS]: 'Tín hiệu',
  [FEATURES.AI_ANALYSIS]: 'Phân tích AI',
  [FEATURES.PORTFOLIO]: 'Danh mục',
  [FEATURES.ALERTS]: 'Cảnh báo',
}

/**
 * Check if a feature is premium-only
 */
export function isPremiumFeature(feature: Feature): boolean {
  return PREMIUM_FEATURES.includes(feature)
}

/**
 * Clear permissions cache (call on login/logout)
 */
export function clearPermissionsCache() {
  cache.isPremium = null
  cache.features = null
}

/**
 * Check if user can access a feature (calls Supabase function with retry)
 */
export async function canAccessFeature(feature: Feature, retries = 1): Promise<boolean> {
  try {
    // Check if feature is in FREE_FEATURES first (no need to query)
    if (FREE_FEATURES.includes(feature)) {
      return true
    }

    // For premium features, check user's premium status with cache
    const isPremium = await isPremiumUser()
    return isPremium
  } catch (error) {
    console.error('Error in canAccessFeature:', error)

    // Retry once on network error
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return canAccessFeature(feature, retries - 1)
    }

    return false
  }
}

/**
 * Get list of features user can access (with caching)
 */
export async function getAccessibleFeatures(useCache = true): Promise<Feature[]> {
  try {
    // Check cache first
    if (useCache && cache.features) {
      const now = Date.now()
      if (now - cache.features.timestamp < CACHE_TTL) {
        return cache.features.value
      }
    }

    // Check if user is premium
    const isPremium = await isPremiumUser()

    // Premium users get all features, free users get FREE_FEATURES only
    const accessible = isPremium ? ALL_FEATURES : FREE_FEATURES

    // Update cache
    cache.features = {
      value: accessible,
      timestamp: Date.now()
    }

    return accessible
  } catch (error) {
    console.error('Error in getAccessibleFeatures:', error)
    return FREE_FEATURES
  }
}

/**
 * Check if user has premium membership (with caching)
 */
export async function isPremiumUser(useCache = true): Promise<boolean> {
  try {
    // Check cache first
    if (useCache && cache.isPremium) {
      const now = Date.now()
      if (now - cache.isPremium.timestamp < CACHE_TTL) {
        return cache.isPremium.value
      }
    }

    // Fetch fresh data
    const { data, error } = await supabase.rpc('is_premium_user')

    if (error) {
      console.error('Error checking premium status:', error)
      return false
    }

    const isPremium = data === true

    // Update cache
    cache.isPremium = {
      value: isPremium,
      timestamp: Date.now()
    }

    return isPremium
  } catch (error) {
    console.error('Error in isPremiumUser:', error)
    return false
  }
}

/**
 * Get feature for a route path
 */
export function getFeatureForRoute(pathname: string): Feature | null {
  // Exact match
  if (ROUTE_FEATURES[pathname]) {
    return ROUTE_FEATURES[pathname]
  }

  // Partial match (e.g., /stocks/AAPL matches /stocks)
  const matchingRoute = Object.keys(ROUTE_FEATURES).find(route =>
    pathname.startsWith(route)
  )

  return matchingRoute ? ROUTE_FEATURES[matchingRoute] : null
}

/**
 * Require premium - throws error if not premium
 * Use this in protected API routes or server actions
 */
export async function requirePremium(): Promise<void> {
  const isPremium = await isPremiumUser()

  if (!isPremium) {
    throw new Error('This feature requires Premium membership. Please upgrade your account.')
  }
}
