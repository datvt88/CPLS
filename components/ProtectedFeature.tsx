'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// 👇 Thay đổi quan trọng: Dùng Hook từ Context thay vì hàm trực tiếp
import { usePermissions } from '@/contexts/PermissionsContext' 
import { FEATURE_NAMES, type Feature } from '@/lib/permissions'

interface ProtectedFeatureProps {
  feature: Feature
  children: React.ReactNode
  fallback?: React.ReactNode // Hiển thị gì nếu không có quyền (VD: Nút nâng cấp)
  redirect?: boolean // Có chuyển hướng sang trang /upgrade không?
}

export default function ProtectedFeature({ 
  feature, 
  children, 
  fallback, 
  redirect = false 
}: ProtectedFeatureProps) {
  const router = useRouter()
  // 👇 Lấy quyền từ Context (đã được cache và xử lý an toàn)
  const { canAccess, isLoading } = usePermissions()

  const hasAccess = canAccess(feature)

  useEffect(() => {
    if (!isLoading && !hasAccess && redirect) {
      router.push('/upgrade')
    }
  }, [isLoading, hasAccess, redirect, router])

  // 1. Đang tải -> Render null hoặc Skeleton (Tùy chọn)
  if (isLoading) {
    return <div className="animate-pulse h-20 bg-gray-800/50 rounded-lg"></div>
  }

  // 2. Có quyền -> Render nội dung
  if (hasAccess) {
    return <>{children}</>
  }

  // 3. Không có quyền -> Render Fallback hoặc Banner mặc định
  if (fallback) {
    return <>{fallback}</>
  }

  // Fallback mặc định nếu không truyền prop fallback
  return (
    <div className="p-6 border border-purple-500/30 bg-gradient-to-br from-purple-900/10 to-gray-900/50 rounded-xl text-center">
      <div className="mb-3 inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 text-purple-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-white mb-1">
        Tính năng {FEATURE_NAMES[feature] || 'Cao cấp'}
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Nâng cấp tài khoản lên Premium để mở khóa tính năng này.
      </p>
      <button 
        onClick={() => router.push('/upgrade')}
        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/20 transition-all"
      >
        Nâng cấp ngay
      </button>
    </div>
  )
}
