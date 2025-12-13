'use client'

import { useRouter } from 'next/navigation'
import { useSubscription, formatDate, getStatusBadgeClasses, getStatusLabel } from '@/hooks/useSubscription'

/**
 * SubscriptionStatusCard Component
 * Displays subscription status in a card format for use in profile pages
 */
export default function SubscriptionStatusCard() {
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
      <div className="p-4 bg-[#2C2C2C] rounded-lg border border-[#3E3E3E] animate-pulse">
        <div className="h-6 bg-gray-600 rounded w-32 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-48"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Main status card */}
      <div className={`p-4 rounded-lg border flex items-center justify-between ${
        isPremium 
          ? isExpired
            ? 'bg-red-900/20 border-red-500/30'
            : isExpiringSoon 
              ? 'bg-yellow-900/20 border-yellow-500/30'
              : 'bg-purple-900/20 border-purple-500/30'
          : 'bg-[#2C2C2C] border-[#3E3E3E]'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-gray-300 font-medium">Trạng thái hiện tại</p>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getStatusBadgeClasses(status)}`}>
              {getStatusLabel(status)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className={`text-lg font-bold ${
              isPremium && !isExpired
                ? 'text-purple-400' 
                : 'text-gray-400'
            }`}>
              {isPremium && !isExpired ? (
                <>
                  <span className="mr-1">⭐</span>
                  Thành viên PREMIUM
                </>
              ) : (
                'Thành viên Miễn phí'
              )}
            </p>
          </div>
          {/* Expiry info */}
          {isPremium && expiresAt && (
            <p className="text-sm text-gray-500 mt-1">
              Hết hạn: {formatDate(expiresAt)}
              {remainingDays !== null && remainingDays > 0 && (
                <span className={`ml-1 ${isExpiringSoon ? 'text-yellow-400' : 'text-gray-500'}`}>
                  (còn {remainingDays} ngày)
                </span>
              )}
              {isExpired && (
                <span className="ml-1 text-red-400">(đã hết hạn)</span>
              )}
            </p>
          )}
        </div>
        
        {/* Action buttons */}
        <div>
          {!isPremium && (
            <button 
              onClick={() => router.push('/upgrade')} 
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/25"
            >
              Nâng cấp
            </button>
          )}
          {isPremium && (isExpiringSoon || isExpired) && (
            <button 
              onClick={() => router.push('/upgrade')} 
              className={`px-4 py-2 text-white text-sm font-semibold rounded-lg transition-all ${
                isExpired 
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              Gia hạn
            </button>
          )}
        </div>
      </div>

      {/* Warning messages */}
      {isExpiringSoon && !isExpired && (
        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            Gói Premium của bạn sẽ hết hạn trong <strong>{remainingDays} ngày</strong>. 
            Gia hạn ngay để không bị gián đoạn dịch vụ.
          </span>
        </div>
      )}

      {isExpired && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Gói Premium của bạn đã hết hạn. 
            Một số tính năng cao cấp đã bị tạm khóa. Gia hạn ngay để tiếp tục sử dụng.
          </span>
        </div>
      )}
    </div>
  )
}
