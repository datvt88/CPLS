'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePermissions } from '@/contexts/PermissionsContext'
import { supabase } from '@/lib/supabaseClient'

// Subscription status types
export type SubscriptionStatus = 'free' | 'active' | 'expiring' | 'expired'

// Subscription tier types
export type MembershipTier = 'free' | 'premium'

// Subscription plan duration in days
export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  duration: number
  features: string[]
  isPopular?: boolean
}

// Hook return type
export interface UseSubscriptionReturn {
  // Subscription state
  status: SubscriptionStatus
  tier: MembershipTier
  expiresAt: Date | null
  remainingDays: number | null
  
  // Computed properties
  isPremium: boolean
  isExpiringSoon: boolean
  isExpired: boolean
  
  // Actions
  refresh: () => Promise<void>
  
  // Loading state
  isLoading: boolean
}

// Warning threshold for expiring subscriptions (in days)
const EXPIRING_WARNING_DAYS = 7

/**
 * Hook for managing subscription state
 * Provides subscription status, tier, expiry information, and computed properties
 */
export function useSubscription(): UseSubscriptionReturn {
  const { isPremium, userId, refresh: refreshPermissions, isLoading: permissionsLoading } = usePermissions()
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load subscription data from profile
  const loadSubscriptionData = useCallback(async () => {
    if (!userId) {
      setExpiresAt(null)
      setIsLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('membership, membership_expires_at')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setExpiresAt(data.membership_expires_at ? new Date(data.membership_expires_at) : null)
      }
    } catch (error) {
      console.error('[useSubscription] Error loading subscription data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Load subscription data when userId changes
  useEffect(() => {
    loadSubscriptionData()
  }, [loadSubscriptionData])

  // Calculate remaining days
  const remainingDays = useMemo(() => {
    if (!expiresAt) return null
    const now = new Date()
    const diffTime = expiresAt.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }, [expiresAt])

  // Determine if subscription is expiring soon
  const isExpiringSoon = useMemo(() => {
    if (remainingDays === null) return false
    return remainingDays > 0 && remainingDays <= EXPIRING_WARNING_DAYS
  }, [remainingDays])

  // Determine if subscription has expired
  const isExpired = useMemo(() => {
    if (!expiresAt) return false
    return new Date() > expiresAt
  }, [expiresAt])

  // Determine subscription status
  const status = useMemo((): SubscriptionStatus => {
    if (!isPremium) return 'free'
    if (isExpired) return 'expired'
    if (isExpiringSoon) return 'expiring'
    return 'active'
  }, [isPremium, isExpired, isExpiringSoon])

  // Determine tier
  const tier = useMemo((): MembershipTier => {
    return isPremium && !isExpired ? 'premium' : 'free'
  }, [isPremium, isExpired])

  // Refresh subscription data
  const refresh = useCallback(async () => {
    setIsLoading(true)
    await refreshPermissions()
    await loadSubscriptionData()
  }, [refreshPermissions, loadSubscriptionData])

  return {
    status,
    tier,
    expiresAt,
    remainingDays,
    isPremium: isPremium && !isExpired,
    isExpiringSoon,
    isExpired,
    refresh,
    isLoading: isLoading || permissionsLoading,
  }
}

/**
 * Format price to Vietnamese currency
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price)
}

/**
 * Format date to Vietnamese locale
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'Không giới hạn'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Get status badge color classes
 */
export function getStatusBadgeClasses(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'expiring':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'expired':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    case 'free':
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

/**
 * Get status label text
 */
export function getStatusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case 'active':
      return 'Đang hoạt động'
    case 'expiring':
      return 'Sắp hết hạn'
    case 'expired':
      return 'Đã hết hạn'
    case 'free':
    default:
      return 'Miễn phí'
  }
}

export default useSubscription
