'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'
import { supabase } from '@/lib/supabaseClient'

interface ProtectedRouteProps {
  children: React.ReactNode
  requirePremium?: boolean
  requireVIP?: boolean // Deprecated
}

// Helper: retry với delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default function ProtectedRoute({
  children,
  requirePremium = false,
  requireVIP = false
}: ProtectedRouteProps) {
  const router = useRouter()
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyAttempts, setVerifyAttempts] = useState(0)
  const hasRedirected = useRef(false)
  const verificationInProgress = useRef(false)

  const {
    isAuthenticated,
    isPremium,
    isLoading,
    isRevalidating,
    isError,
    refresh
  } = usePermissions()

  const needsPremium = requirePremium || requireVIP
  const MAX_VERIFY_ATTEMPTS = 3

  // Session verification với retry logic
  const verifySession = useCallback(async (): Promise<boolean> => {
    try {
      // Bước 1: Kiểm tra session hiện tại
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        console.log('✅ [ProtectedRoute] Session found')
        return true
      }

      // Bước 2: Thử refresh token nếu không có session
      console.log('🔄 [ProtectedRoute] No session, attempting token refresh...')
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshData.session && !refreshError) {
        console.log('✅ [ProtectedRoute] Token refresh successful')
        return true
      }

      // Bước 3: Kiểm tra localStorage/cookie backup
      console.log('⚠️ [ProtectedRoute] No valid session found after refresh')
      return false
    } catch (error) {
      console.error('❌ [ProtectedRoute] Session verification error:', error)
      return false
    }
  }, [])

  // Xử lý chuyển hướng - CHỈ redirect sau khi verify session thực sự
  useEffect(() => {
    const verifyAndRedirect = async () => {
      // Đã redirect rồi thì không làm gì
      if (hasRedirected.current) return
      
      // Tránh multiple verification đồng thời
      if (verificationInProgress.current) return

      // Đang loading hoặc revalidating thì chờ
      if (isLoading || isRevalidating) return

      // Nếu context nói đã authenticated -> OK
      if (isAuthenticated) {
        // Reset verify attempts khi thành công
        setVerifyAttempts(0)
        
        // Kiểm tra premium nếu cần
        if (needsPremium && !isPremium) {
          hasRedirected.current = true
          router.push('/upgrade')
        }
        return
      }

      // Context nói chưa authenticated -> verify lại session thực sự
      // Tránh trường hợp context chưa cập nhật sau khi quay lại app
      verificationInProgress.current = true
      setIsVerifying(true)

      try {
        const hasValidSession = await verifySession()

        if (!hasValidSession) {
          // Nếu còn attempts, thử lại với delay
          if (verifyAttempts < MAX_VERIFY_ATTEMPTS - 1) {
            console.log(`🔄 [ProtectedRoute] Verify attempt ${verifyAttempts + 1}/${MAX_VERIFY_ATTEMPTS}`)
            setVerifyAttempts(prev => prev + 1)
            // True exponential backoff: 500ms, 1000ms, 2000ms
            await delay(500 * Math.pow(2, verifyAttempts))
            verificationInProgress.current = false
            return // Sẽ trigger lại effect
          }

          // Hết attempts -> redirect
          console.log('🔒 [ProtectedRoute] No session after retries, redirecting to login')
          hasRedirected.current = true
          router.push('/login')
        } else {
          // Có session nhưng context chưa cập nhật -> refresh context
          console.log('🔄 [ProtectedRoute] Session exists, refreshing permissions...')
          await refresh()
          setVerifyAttempts(0)
        }
      } catch (error) {
        console.error('❌ [ProtectedRoute] Session verification error:', error)
        // Lỗi verify -> không redirect ngay, thử lại
        if (verifyAttempts < MAX_VERIFY_ATTEMPTS - 1) {
          setVerifyAttempts(prev => prev + 1)
        }
      } finally {
        setIsVerifying(false)
        verificationInProgress.current = false
      }
    }

    verifyAndRedirect()
  }, [isLoading, isRevalidating, isAuthenticated, isPremium, needsPremium, router, refresh, verifySession, verifyAttempts])

  // Reset redirect flag khi unmount
  useEffect(() => {
    return () => {
      hasRedirected.current = false
      verificationInProgress.current = false
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
