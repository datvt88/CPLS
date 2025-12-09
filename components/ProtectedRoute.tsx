'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requirePremium?: boolean
  requireVIP?: boolean // Deprecated
}

export default function ProtectedRoute({
  children,
  requirePremium = false,
  requireVIP = false
}: ProtectedRouteProps) {
  const router = useRouter()
  
  // Lấy dữ liệu từ Context (Đã được SWR tối ưu caching, timeout và reload)
  const { 
    isAuthenticated, 
    isPremium, 
    isLoading, 
    isError, 
    refresh 
  } = usePermissions()
  
  const needsPremium = requirePremium || requireVIP

  // Xử lý chuyển hướng (Redirect Logic)
  useEffect(() => {
    // Chỉ chạy logic khi đã tải xong dữ liệu và không có lỗi
    if (!isLoading && !isError) {
      // 1. Chưa đăng nhập -> Login
      if (!isAuthenticated) {
        router.push('/login')
        return
      }

      // 2. Cần Premium mà không có -> Upgrade
      if (needsPremium && !isPremium) {
        router.push('/upgrade')
        return
      }
    }
  }, [isLoading, isError, isAuthenticated, isPremium, needsPremium, router])

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
  // OPTIMIZED: Faster perceived load with skeleton UI instead of blocking spinner
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] p-6 animate-[fadeIn_0.2s_ease-out]">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Skeleton Header */}
          <div className="h-8 bg-gradient-to-r from-[#2C2C2C] via-[#383838] to-[#2C2C2C] rounded-lg w-64 animate-pulse"></div>

          {/* Skeleton Content Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1E1E1E] rounded-xl p-6 space-y-3 animate-pulse">
                <div className="h-6 bg-[#2C2C2C] rounded w-3/4"></div>
                <div className="h-4 bg-[#2C2C2C] rounded w-full"></div>
                <div className="h-4 bg-[#2C2C2C] rounded w-5/6"></div>
              </div>
            ))}
          </div>

          {/* Small loading indicator */}
          <div className="fixed bottom-4 right-4 bg-purple-600/20 backdrop-blur-sm border border-purple-500/30 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
            <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-purple-300 font-medium">Đang xác thực...</span>
          </div>
        </div>
      </div>
    )
  }

  // --- TRƯỜNG HỢP 3: CHƯA ĐỦ ĐIỀU KIỆN ---
  // Return null để tránh "nháy" nội dung cấm trước khi redirect
  if (!isAuthenticated || (needsPremium && !isPremium)) {
    return null
  }

  // --- TRƯỜNG HỢP 4: HỢP LỆ ---
  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {children}
    </div>
  )
}
