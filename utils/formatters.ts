/**
 * Formatting utilities for stock data
 * Standardizes price, volume, and financial metric formatting across the application
 */

/**
 * Format a price value in VND with thousands separators
 * @param value - Price value
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatPrice(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  return value.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Format volume in millions (M) or thousands (K)
 * @param value - Volume value
 */
export function formatVolume(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`
  }
  return value.toFixed(0)
}

/**
 * Format market cap in trillions (nghìn tỷ) or billions (tỷ)
 * @param value - Market cap value in VND
 */
export function formatMarketCap(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }

  if (value >= 1000000000000) {
    return `${(value / 1000000000000).toFixed(2)} nghìn tỷ`
  } else if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)} tỷ`
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)} triệu`
  }
  return formatPrice(value, 0)
}

/**
 * Format percentage value
 * @param value - Decimal value (e.g., 0.15 for 15%)
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format ratio (e.g., P/E, P/B, Beta)
 * @param value - Ratio value
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatRatio(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  return value.toFixed(decimals)
}

/**
 * Format number of shares
 * @param value - Number of shares
 */
export function formatShares(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }

  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)} tỷ CP`
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)} triệu CP`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} nghìn CP`
  }
  return `${value.toFixed(0)} CP`
}

/**
 * Format currency value in VND (billions)
 * @param value - Value in VND
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }

  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)} tỷ VNĐ`
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)} triệu VNĐ`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} nghìn VNĐ`
  }
  return `${value.toFixed(0)} VNĐ`
}

/**
 * Format change value with + or - sign and color class
 * @param value - Change value
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatChange(value: number | undefined | null, decimals: number = 2): {
  text: string
  colorClass: string
} {
  if (value === undefined || value === null || isNaN(value)) {
    return { text: 'N/A', colorClass: 'text-gray-400' }
  }

  const sign = value >= 0 ? '+' : ''
  const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-yellow-400'

  return {
    text: `${sign}${value.toFixed(decimals)}`,
    colorClass,
  }
}

/**
 * Format percentage change with + or - sign and color class
 * @param value - Percentage change as decimal (e.g., 0.05 for 5%)
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatPercentageChange(value: number | undefined | null, decimals: number = 2): {
  text: string
  colorClass: string
} {
  if (value === undefined || value === null || isNaN(value)) {
    return { text: 'N/A', colorClass: 'text-gray-400' }
  }

  const sign = value >= 0 ? '+' : ''
  const colorClass = value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-yellow-400'

  return {
    text: `${sign}${(value * 100).toFixed(decimals)}%`,
    colorClass,
  }
}

/**
 * Generic formatter for financial ratios based on ratio code
 * @param ratioCode - The ratio code (e.g., 'MARKETCAP', 'P/E')
 * @param value - The value to format
 */
export function formatFinancialRatio(ratioCode: string, value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }

  switch (ratioCode) {
    case 'MARKETCAP':
      return formatMarketCap(value)

    case 'NMVOLUME_AVG_CR_10D':
      return formatVolume(value)

    case 'PRICE_HIGHEST_CR_52W':
    case 'PRICE_LOWEST_CR_52W':
    case 'BVPS_CR':
    case 'EPS_TR':
      return formatPrice(value, 0)

    case 'OUTSTANDING_SHARES':
      return formatShares(value)

    case 'FREEFLOAT':
    case 'DIVIDEND_YIELD':
    case 'ROAE_TR_AVG5Q':
    case 'ROAA_TR_AVG5Q':
      return formatPercentage(value)

    case 'BETA':
    case 'PRICE_TO_EARNINGS':
    case 'PRICE_TO_BOOK':
      return formatRatio(value)

    default:
      return formatRatio(value)
  }
}
