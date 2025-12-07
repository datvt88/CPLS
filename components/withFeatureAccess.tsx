// components/withFeatureAccess.tsx
'use client'

import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { Feature } from '@/lib/permissions'

interface WithFeatureAccessOptions {
  feature?: Feature
  redirectUrl?: string
}

export default function withFeatureAccess<P extends object>(
  Component: React.ComponentType<P>,
  options: WithFeatureAccessOptions = {}
) {
  return function WithFeatureAccessWrapper(props: P) {
    // Bắt buộc redirect nếu không có quyền
    const { hasAccess, isLoading } = useFeatureAccess({
      feature: options.feature,
      redirectUrl: options.redirectUrl,
      requireAccess: true 
    })

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[--bg]">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )
    }

    if (!hasAccess) return null

    return <Component {...props} />
  }
}
