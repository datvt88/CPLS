// components/ProtectedFeature.tsx
'use client'

import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { usePermissions } from '@/contexts/PermissionsContext'
import { FEATURE_NAMES, type Feature } from '@/lib/permissions'
import { useRouter } from 'next/navigation'

interface ProtectedFeatureProps {
  feature: Feature
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function ProtectedFeature({ feature, children, fallback }: ProtectedFeatureProps) {
  const router = useRouter()
  const { refresh, isError } = usePermissions()
  
  const { hasAccess, isLoading } = useFeatureAccess({ 
    feature, 
    requireAccess: false 
  })

  // 1. Loading
  if (isLoading) return <div className="animate-pulse h-20 bg-gray-800/50 rounded-lg w-full" />

  // 2. Lỗi kết nối -> Hiện nút thử lại
  if (isError) {
    return (
      <div className="p-6 border border-red-500/30 bg-red-900/10 rounded-xl text-center">
        <div className="mb-2 text-red-400">
          <h3 className="text-lg font-bold">Không thể kiểm tra quyền truy cập</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Vui lòng kiểm tra kết nối mạng.
        </p>
        <button 
          onClick={() => refresh()} 
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg"
        >
          Thử lại
        </button>
      </div>
    )
  }

  // 3. Có quyền -> Hiện nội dung
  if (hasAccess) return <>{children}</>

  // 4. Fallback
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
