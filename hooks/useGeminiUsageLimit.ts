'use client'

/**
 * Hook quản lý số lần sử dụng widget phân tích Gemini (Deep Analysis)
 *
 * Quy tắc:
 * - Không đăng nhập: không được sử dụng (0 lần)
 * - Free user: 3 lần/ngày
 * - Premium user: 20 lần/ngày
 * - Diamond user: không giới hạn
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePermissions } from '@/contexts/PermissionsContext'

// --- CONSTANTS ---
const STORAGE_KEY = 'gemini_usage'
const FREE_LIMIT = 3
const PREMIUM_LIMIT = 20
const DIAMOND_LIMIT = Infinity

interface UsageData {
  count: number
  date: string // Format: YYYY-MM-DD
}

interface GeminiUsageLimitReturn {
  // Trạng thái
  canUse: boolean
  usageCount: number
  usageLimit: number
  remainingUsage: number

  // Thông tin
  isUnlimited: boolean
  isGuest: boolean

  // Actions
  incrementUsage: () => boolean // Returns true if increment successful
  resetUsage: () => void

  // Messages
  limitMessage: string
}

// Helper: Lấy ngày hiện tại dạng YYYY-MM-DD
const getTodayString = (): string => {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

// Helper: Đọc usage từ localStorage
const getStoredUsage = (userId: string | null): UsageData => {
  if (typeof window === 'undefined') {
    return { count: 0, date: getTodayString() }
  }

  try {
    const key = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY
    const stored = localStorage.getItem(key)

    if (!stored) {
      return { count: 0, date: getTodayString() }
    }

    const data: UsageData = JSON.parse(stored)

    // Reset nếu qua ngày mới
    if (data.date !== getTodayString()) {
      return { count: 0, date: getTodayString() }
    }

    return data
  } catch {
    return { count: 0, date: getTodayString() }
  }
}

// Helper: Lưu usage vào localStorage
const setStoredUsage = (userId: string | null, data: UsageData): void => {
  if (typeof window === 'undefined') return

  try {
    const key = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    console.warn('[useGeminiUsageLimit] Cannot save to localStorage')
  }
}

export function useGeminiUsageLimit(): GeminiUsageLimitReturn {
  const { isAuthenticated, isPremium, isDiamond, userId } = usePermissions()

  const [usageData, setUsageData] = useState<UsageData>({ count: 0, date: getTodayString() })

  // Load usage từ localStorage khi mount hoặc khi userId thay đổi
  useEffect(() => {
    const stored = getStoredUsage(userId)
    setUsageData(stored)
  }, [userId])

  // Tính toán các giá trị - Diamond tier có không giới hạn
  const isUnlimited = isDiamond
  const isGuest = !isAuthenticated

  const usageLimit = useMemo(() => {
    if (isUnlimited) return DIAMOND_LIMIT
    if (isGuest) return 0
    if (isPremium) return PREMIUM_LIMIT
    return FREE_LIMIT
  }, [isUnlimited, isGuest, isPremium])

  const usageCount = usageData.count

  const remainingUsage = useMemo(() => {
    if (isUnlimited) return Infinity
    return Math.max(0, usageLimit - usageCount)
  }, [isUnlimited, usageLimit, usageCount])

  const canUse = useMemo(() => {
    // Guest không được dùng
    if (isGuest) return false

    // Admin/Mod không giới hạn
    if (isUnlimited) return true

    // Check còn lượt không
    return usageCount < usageLimit
  }, [isGuest, isUnlimited, usageCount, usageLimit])

  // Tăng số lần sử dụng
  const incrementUsage = useCallback((): boolean => {
    // Guest không được dùng
    if (isGuest) return false

    // Diamond tier không cần track
    if (isUnlimited) return true

    // Check còn lượt không
    if (usageCount >= usageLimit) return false

    const newData: UsageData = {
      count: usageCount + 1,
      date: getTodayString()
    }

    setUsageData(newData)
    setStoredUsage(userId, newData)

    return true
  }, [isGuest, isUnlimited, usageCount, usageLimit, userId])

  // Reset usage (chủ yếu cho testing)
  const resetUsage = useCallback(() => {
    const newData: UsageData = { count: 0, date: getTodayString() }
    setUsageData(newData)
    setStoredUsage(userId, newData)
  }, [userId])

  // Tạo message phù hợp
  const limitMessage = useMemo(() => {
    if (isGuest) {
      return 'Vui lòng đăng nhập để sử dụng tính năng phân tích Gemini AI'
    }

    if (isUnlimited) {
      return 'Không giới hạn (Diamond)'
    }

    if (!canUse) {
      return isPremium
        ? `Bạn đã hết ${PREMIUM_LIMIT} lượt phân tích hôm nay. Nâng cấp Diamond để không giới hạn.`
        : `Bạn đã hết ${FREE_LIMIT} lượt phân tích miễn phí hôm nay. Nâng cấp Premium (${PREMIUM_LIMIT} lượt/ngày) hoặc Diamond (không giới hạn).`
    }

    if (isPremium) {
      return `Còn ${remainingUsage}/${PREMIUM_LIMIT} lượt phân tích hôm nay`
    }

    return `Còn ${remainingUsage}/${FREE_LIMIT} lượt phân tích miễn phí hôm nay`
  }, [isGuest, isUnlimited, canUse, isPremium, remainingUsage])

  return {
    canUse,
    usageCount,
    usageLimit: isUnlimited ? -1 : usageLimit, // -1 = unlimited
    remainingUsage: isUnlimited ? -1 : remainingUsage,
    isUnlimited,
    isGuest,
    incrementUsage,
    resetUsage,
    limitMessage
  }
}

// Export constants for testing or external use
export const GEMINI_USAGE_LIMITS = {
  FREE: FREE_LIMIT,
  PREMIUM: PREMIUM_LIMIT,
  DIAMOND: DIAMOND_LIMIT
}
