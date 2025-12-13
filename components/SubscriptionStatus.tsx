'use client'

import { useRouter } from 'next/navigation'
import { useSubscription, formatDate, getStatusBadgeClasses, getStatusLabel } from '@/hooks/useSubscription'

interface SubscriptionStatusProps {
  /** Show full status card */
  variant?: 'card' | 'badge' | 'inline'
  /** Show upgrade button for free users */
  showUpgradeButton?: boolean
  /** Custom class name */
  className?: string
}

/**
 * SubscriptionStatus Component
 * Displays the user's current subscription status
 */
export default function SubscriptionStatus({
  variant = 'card',
  showUpgradeButton = true,
  className = '',
}: SubscriptionStatusProps) {
  const router = useRouter()
  const {
    status,
    tier,
    expiresAt,
    remainingDays,
    isPremium,
    isExpiringSoon,
    isExpired,
    isLoading,
  } = useSubscription()

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-gray-700 rounded w-24"></div>
      </div>
    )
  }

  // Badge variant - compact display
  if (variant === 'badge') {
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBadgeClasses(status)} ${className}`}>
        {tier === 'premium' ? '⭐ PREMIUM' : 'FREE'}
      </span>
    )
  }

  // Inline variant - simple text display
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadgeClasses(status)}`}>
          {tier === 'premium' ? 'Premium' : 'Free'}
        </span>
        {expiresAt && isPremium && (
          <span className="text-xs text-gray-500">
            {isExpired ? 'Đã hết hạn' : `Còn ${remainingDays} ngày`}
          </span>
        )}
      </div>
    )
  }

  // Card variant - full display
  return (
    <div className={`bg-[#1E1E1E] rounded-xl border border-[#2C2C2C] p-6 ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {isPremium ? (
              <>
                <span className="text-2xl">⭐</span>
                Premium
              </>
            ) : (
              <>
                <span className="text-2xl">👤</span>
                Miễn phí
              </>
            )}
          </h3>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadgeClasses(status)}`}>
              {getStatusLabel(status)}
            </span>
            {expiresAt && isPremium && (
              <span className="text-sm text-gray-400">
                Hết hạn: {formatDate(expiresAt)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isPremium && showUpgradeButton && (
            <button
              onClick={() => router.push('/upgrade')}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/25"
            >
              Nâng cấp Premium
            </button>
          )}
          {isExpiringSoon && showUpgradeButton && (
            <button
              onClick={() => router.push('/upgrade')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Gia hạn ngay
            </button>
          )}
          {isExpired && showUpgradeButton && (
            <button
              onClick={() => router.push('/upgrade')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Gia hạn ngay
            </button>
          )}
        </div>
      </div>

      {/* Warning messages */}
      {isExpiringSoon && !isExpired && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
          ⚠️ Gói Premium của bạn sẽ hết hạn trong {remainingDays} ngày. Gia hạn ngay để không bị gián đoạn dịch vụ.
        </div>
      )}
      {isExpired && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          ❌ Gói Premium của bạn đã hết hạn. Gia hạn ngay để tiếp tục sử dụng các tính năng Premium.
        </div>
      )}
    </div>
  )
}
