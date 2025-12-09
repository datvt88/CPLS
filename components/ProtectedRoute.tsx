'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'
import { supabase } from '@/lib/supabaseClient'

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
  const [isVerifying, setIsVerifying] = useState(false)
  const hasRedirected = useRef(false)

  const {
    isAuthenticated,
    isPremium,
    isLoading,
    isRevalidating,
    isError,
    refresh
  } = usePermissions()

  const needsPremium = requirePremium || requireVIP

  // Xử lý chuyển hướng - CHỈ redirect sau khi verify session thực sự
  useEffect(() => {
    const verifyAndRedirect = async () => {
      // Đã redirect rồi thì không làm gì
      if (hasRedirected.current) return

      // Đang loading hoặc revalidating thì chờ
      if (isLoading || isRevalidating) return

      // Nếu context nói đã authenticated -> OK
      if (isAuthenticated) {
        // Kiểm tra premium nếu cần
        if (needsPremium && !isPremium) {
          hasRedirected.current = true
          router.push('/upgrade')
        }
        return
      }

      // Context nói chưa authenticated -> verify lại session thực sự
      // Tránh trường hợp context chưa cập nhật sau khi quay lại app
      setIsVerifying(true)

      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          // Thực sự chưa đăng nhập -> redirect
          console.log('🔒 [ProtectedRoute] No session found, redirecting to login')
          hasRedirected.current = true
          router.push('/login')
        } else {
          // Có session nhưng context chưa cập nhật -> refresh context
          console.log('🔄 [ProtectedRoute] Session exists, refreshing permissions...')
          await refresh()
        }
      } catch (error) {
        console.error('❌ [ProtectedRoute] Session verification error:', error)
        // Lỗi verify -> không redirect, để user thử lại
      } finally {
        setIsVerifying(false)
      }
    }

    verifyAndRedirect()
  }, [isLoading, isRevalidating, isAuthenticated, isPremium, needsPremium, router, refresh])

  // Reset redirect flag khi unmount
  useEffect(() => {
    return () => {
      hasRedirected.current = false
    }
  }, [])

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

  // --- TRƯỜNG HỢP 2: ĐANG TẢI LẦN ĐẦU ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#2C2C2C] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400 font-medium animate-pulse">Đang kiểm tra quyền...</p>
        </div>
      </div>
    )
  }

  // --- TRƯỜNG HỢP 3: ĐANG VERIFY SESSION ---
  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-[#2C2C2C] rounded-full"></div>
            <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-400 text-sm">Đang xác thực...</p>
        </div>
      </div>
    )
  }

  // --- TRƯỜNG HỢP 4: ĐÃ AUTHENTICATED ---
  if (isAuthenticated) {
    // Kiểm tra premium
    if (needsPremium && !isPremium) {
      return null // Đang chờ redirect
    }

    return (
      <div className="animate-[fadeIn_0.2s_ease-out]">
        {children}
      </div>
    )
  }

  // --- TRƯỜNG HỢP 5: CHƯA XÁC ĐỊNH ---
  // Đang chờ verify hoặc redirect
  return null
}
