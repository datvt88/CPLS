'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  requirePremium?: boolean
  requireVIP?: boolean // Deprecated, mapping to requirePremium
}

export default function ProtectedRoute({
  children,
  requirePremium = false,
  requireVIP = false
}: ProtectedRouteProps) {
  const router = useRouter()
  // Lấy dữ liệu trực tiếp từ Context (đã được SWR quản lý cache & loading)
  const { isPremium, isLoading, canAccess } = usePermissions()
  
  const needsPremium = requirePremium || requireVIP

  useEffect(() => {
    // Chỉ xử lý chuyển hướng khi ĐÃ TẢI XONG dữ liệu
    if (!isLoading) {
      // 1. Kiểm tra session gián tiếp:
      // Nếu load xong mà không có quyền gì cả (Accessible features rỗng hoặc mặc định Free)
      // thì có thể hiểu là chưa đăng nhập hoặc lỗi.
      // Tuy nhiên, cách an toàn nhất là dựa vào logic của bạn: 
      // Nếu cần Premium mà không phải Premium -> Chuyển hướng.
      
      // Lưu ý: PermissionsContext mặc định trả về Free features nếu chưa login.
      // Nên nếu route này yêu cầu đăng nhập cơ bản (không cần premium),
      // ta nên check thêm một flag isAuthenticated từ context nếu có, 
      // hoặc đơn giản là check xem có feature nào không.
      
      // Ở đây giả định ProtectedRoute luôn cần ít nhất là đăng nhập.
      // Nếu PermissionsContext trả về Free Features (mặc định), ta cần check xem có session thật không.
      // Nhưng để đơn giản và tận dụng SWR:
      
      if (needsPremium && !isPremium) {
        router.push('/upgrade')
      }
      
      // Nếu bạn muốn check login cho trang thường:
      // Bạn có thể thêm isAuthenticated vào PermissionsContext hoặc check length features
    }
  }, [isLoading, isPremium, needsPremium, router])

  // --- TRẠNG THÁI LOADING ---
  // Nếu đang loading lần đầu (F5), hiện màn hình chờ.
  // Nếu là Silent Refresh (quay lại tab), isLoading sẽ là false -> KHÔNG hiện màn hình chờ -> MƯỢT.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[--bg]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          {/* <p className="text-gray-400">Đang tải...</p> */}
        </div>
      </div>
    )
  }

  // --- XỬ LÝ HIỂN THỊ ---
  
  // 1. Yêu cầu Premium nhưng không có -> Return null (đợi useEffect redirect)
  if (needsPremium && !isPremium) {
    return null
  }

  // 2. Các trường hợp khác (Đủ quyền hoặc trang thường) -> Render
  return <>{children}</>
}
