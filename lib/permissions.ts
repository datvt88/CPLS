// lib/permissions.ts

export const FEATURES = {
  // Free features
  DASHBOARD: 'dashboard',
  STOCKS: 'stocks',
  MARKET: 'market',
  PROFILE: 'profile',
  SIGNALS: 'signals', // Bạn để Signals là Free ở code trước

  // Premium only features
  AI_ANALYSIS: 'ai-analysis',
  PORTFOLIO: 'portfolio',
  ALERTS: 'alerts',
} as const

export type Feature = typeof FEATURES[keyof typeof FEATURES]

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

export function isPremiumFeature(feature: Feature): boolean {
  return PREMIUM_FEATURES.includes(feature)
}

export function getFeatureForRoute(pathname: string): Feature | null {
  if (ROUTE_FEATURES[pathname]) return ROUTE_FEATURES[pathname]
  const matchingRoute = Object.keys(ROUTE_FEATURES).find(route => pathname.startsWith(route))
  return matchingRoute ? ROUTE_FEATURES[matchingRoute] : null
}
