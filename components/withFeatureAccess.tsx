'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
// 👇 Thay đổi: Import Hook từ Context thay vì hàm trực tiếp
import { usePermissions } from '@/contexts/PermissionsContext'
import { getFeatureForRoute, type Feature } from '@/lib/permissions'

interface WithFeatureAccessOptions {
  feature?: Feature
  redirectUrl?: string
}

/**
 * HOC to protect pages based on user permissions
 */
export default function withFeatureAccess<P extends object>(
  Component: React.ComponentType<P>,
  options: WithFeatureAccessOptions = {}
) {
  return function WithFeatureAccessWrapper(props: P) {
    const router = useRouter()
    const pathname = usePathname()
    
    // 👇 Lấy quyền từ Context (Đã được cache và xử lý an toàn)
    const { canAccess, isLoading } = usePermissions()

    // Xác định tính năng cần kiểm tra (từ option hoặc tự động theo route)
    const featureToCheck = options.feature || getFeatureForRoute(pathname)

    // Kiểm tra quyền
    // Nếu không có feature cụ thể (trang public), mặc định là true
    const hasAccess = featureToCheck ? canAccess(featureToCheck) : true

    useEffect(() => {
      // Chỉ redirect khi đã tải xong data và xác định là KHÔNG có quyền
      if (!isLoading && featureToCheck && !hasAccess) {
        const target = options.redirectUrl || '/upgrade'
        router.push(target)
      }
    }, [isLoading, hasAccess, featureToCheck, router, options.redirectUrl])

    // 1. Đang tải -> Render màn hình trắng hoặc Loading (Tránh flash nội dung cấm)
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[--bg]">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )
    }

    // 2. Không có quyền -> Return null (Sẽ bị useEffect redirect đi ngay sau đó)
    if (featureToCheck && !hasAccess) {
      return null
    }

    // 3. Có quyền -> Render Component gốc
    return <Component {...props} />
  }
}
