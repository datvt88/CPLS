// components/ProtectedFeature.tsx
'use client'

import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { FEATURE_NAMES, type Feature } from '@/lib/permissions'
import { useRouter } from 'next/navigation'

interface ProtectedFeatureProps {
  feature: Feature
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function ProtectedFeature({ feature, children, fallback }: ProtectedFeatureProps) {
  const router = useRouter()
  
  // Gọi hook, không redirect tự động để hiển thị UI fallback
  const { hasAccess, isLoading } = useFeatureAccess({ 
    feature, 
    requireAccess: false 
  })

  if (isLoading) return <div className="animate-pulse h-20 bg-gray-800/50 rounded-lg w-full" />

  if (hasAccess) return <>{children}</>

  if (fallback) return <>{fallback}</>

  return (
    <div className="p-6 border border-purple-500/30 bg-gradient-to-br from-purple-900/10 to-gray-900/50 rounded-xl text-center">
      <h3 className="text-lg font-bold text-white mb-2">
        Tính năng {FEATURE_NAMES[feature]}
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Tính năng này dành riêng cho thành viên Premium.
      </p>
      <button 
        onClick={() => router.push('/upgrade')}
        className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-all shadow-lg hover:shadow-purple-500/20"
      >
        Nâng cấp ngay
      </button>
    </div>
  )
}
