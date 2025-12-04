import { supabase } from './supabaseClient'

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
  FEATURES.SIGNALS,
]

export const PREMIUM_FEATURES: Feature[] = [
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
 * Check if user can access a feature (calls Supabase function)
 */
export async function canAccessFeature(feature: Feature): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('can_access_feature', {
      p_feature: feature,
    })

    if (error) {
      console.error('Error checking feature access:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('Error in canAccessFeature:', error)
    return false
  }
}

/**
 * Get list of features user can access
 */
export async function getAccessibleFeatures(): Promise<Feature[]> {
  try {
    const { data, error } = await supabase.rpc('get_my_accessible_features')

    if (error) {
      console.error('Error getting accessible features:', error)
      return FREE_FEATURES
    }

    // Filter features user has access to
    const accessible = data
      .filter((item: any) => {
        // Premium users get all features
        // Free users only get non-premium features
        return !item.is_premium_only || item.is_premium_only === false
      })
      .map((item: any) => item.feature as Feature)

    return accessible
  } catch (error) {
    console.error('Error in getAccessibleFeatures:', error)
    return FREE_FEATURES
  }
}

/**
 * Check if user has premium membership
 */
export async function isPremiumUser(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_premium_user')

    if (error) {
      console.error('Error checking premium status:', error)
      return false
    }

    return data === true
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
