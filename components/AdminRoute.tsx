'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'

interface AdminRouteProps {
  children: React.ReactNode
}

/**
 * AdminRoute Component
 *
 * Route wrapper cho các trang admin/moderator.
 * Sử dụng PermissionsContext để kiểm tra quyền (không fetch riêng).
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const router = useRouter()
  const {
    isAuthenticated,
    hasAdminAccess,
    isLoading,
    isError,
    refresh
  } = usePermissions()

  // Redirect logic
  useEffect(() => {
    if (!isLoading && !isError) {
      // Chưa đăng nhập -> Login
      if (!isAuthenticated) {
        console.log('❌ [AdminRoute] No session, redirecting to login')
        router.push('/login')
        return
      }

      // Không có quyền admin/mod -> Dashboard
      if (!hasAdminAccess) {
        console.log('❌ [AdminRoute] Access denied: user is not admin/mod')
        router.push('/dashboard')
        return
      }

      console.log('✅ [AdminRoute] Admin/Mod access granted')
    }
  }, [isLoading, isError, isAuthenticated, hasAdminAccess, router])

  // --- TRƯỜNG HỢP 1: LỖI KẾT NỐI ---
  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="text-center p-6 bg-[#1E1E1E] rounded-xl border border-red-500/30 max-w-sm w-full mx-4 shadow-2xl">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Lỗi kết nối</h3>
          <p className="text-gray-400 text-sm mb-6">
            Không thể kiểm tra quyền truy cập. Vui lòng kiểm tra mạng của bạn.
          </p>
          <button
            onClick={() => refresh()}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-red-500/20"
          >
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  // --- TRƯỜNG HỢP 2: ĐANG TẢI ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#2C2C2C] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400 font-medium animate-pulse">Đang kiểm tra quyền quản trị...</p>
        </div>
      </div>
    )
  }

  // --- TRƯỜNG HỢP 3: CHƯA ĐỦ ĐIỀU KIỆN ---
  if (!isAuthenticated || !hasAdminAccess) {
    return null
  }

  // --- TRƯỜNG HỢP 4: HỢP LỆ ---
  return <>{children}</>
}
