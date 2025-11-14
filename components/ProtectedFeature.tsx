'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { canAccessFeature, isPremiumFeature, FEATURE_NAMES, type Feature } from '@/lib/permissions'

interface ProtectedFeatureProps {
  feature: Feature
  children: React.ReactNode
  fallback?: React.ReactNode
  showUpgradePrompt?: boolean
}

/**
 * Component to protect features based on membership tier
 *
 * Usage:
 * <ProtectedFeature feature="signals">
 *   <SignalsContent />
 * </ProtectedFeature>
 */
export function ProtectedFeature({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: ProtectedFeatureProps) {
  const router = useRouter()
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAccess()
  }, [feature])

  const checkAccess = async () => {
    setIsLoading(true)
    const access = await canAccessFeature(feature)
    setHasAccess(access)
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-[--accent] border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (hasAccess === false) {
    if (fallback) {
      return <>{fallback}</>
    }

    if (showUpgradePrompt && isPremiumFeature(feature)) {
      return (
        <UpgradePrompt
          feature={feature}
          onUpgrade={() => router.push('/pricing')}
        />
      )
    }

    return (
      <div className="text-center p-8">
        <p className="text-[--muted]">Bạn không có quyền truy cập tính năng này.</p>
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Upgrade prompt component
 */
function UpgradePrompt({
  feature,
  onUpgrade,
}: {
  feature: Feature
  onUpgrade: () => void
}) {
  const featureName = FEATURE_NAMES[feature] || 'Tính năng này'

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-[--panel] rounded-lg border border-[--border]">
      <div className="mb-6 p-4 bg-[--accent]/10 rounded-full">
        <svg
          className="w-12 h-12 text-[--accent]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      <h3 className="text-2xl font-bold text-[--fg] mb-2">
        {featureName} - Tính năng Premium
      </h3>

      <p className="text-[--muted] text-center mb-6 max-w-md">
        {featureName} chỉ dành cho thành viên Premium.
        Nâng cấp ngay để truy cập tất cả các tính năng cao cấp.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onUpgrade}
          className="px-6 py-3 bg-[--accent] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          Nâng cấp lên Premium
        </button>

        <button
          onClick={() => window.history.back()}
          className="px-6 py-3 bg-[--bg] border border-[--border] text-[--fg] rounded-lg font-semibold hover:bg-[--panel] transition-colors"
        >
          Quay lại
        </button>
      </div>

      <div className="mt-8 pt-6 border-t border-[--border] w-full max-w-md">
        <h4 className="font-semibold text-[--fg] mb-3 text-center">
          Tính năng Premium bao gồm:
        </h4>
        <ul className="space-y-2 text-sm text-[--muted]">
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[--success]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Tín hiệu giao dịch AI</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[--success]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Phân tích thị trường chuyên sâu</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[--success]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Quản lý danh mục đầu tư</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[--success]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Cảnh báo giá theo thời gian thực</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
