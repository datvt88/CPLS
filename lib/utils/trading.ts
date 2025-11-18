/**
 * Trading utility functions
 * Shared utilities for date handling and validation in trading context
 */

/**
 * Get current date in Vietnam timezone (GMT+7)
 * Returns date with time set to 00:00:00
 */
export function getVietnamDate(): Date {
  const now = new Date()
  const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  vietnamTime.setHours(0, 0, 0, 0)
  return vietnamTime
}

/**
 * Validate if a trading date is not in the future
 * @param dateStr - Date string to validate
 * @returns true if date is today or in the past
 */
export function isValidTradingDate(dateStr: string): boolean {
  const dataDate = new Date(dateStr)
  dataDate.setHours(0, 0, 0, 0)
  const today = getVietnamDate()
  return dataDate <= today
}
