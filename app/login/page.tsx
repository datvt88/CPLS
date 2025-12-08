'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authService } from '@/services/auth.service' // 👇 Dùng service chuẩn
import { AuthForm } from '@/components/AuthForm'
import { Suspense } from 'react' // Cần thiết cho useSearchParams trong Next.js

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isChecking, setIsChecking] = useState(true)

  // Lấy trang đích muốn đến (nếu có), hoặc mặc định về dashboard
  const nextUrl = searchParams.get('next') || '/dashboard'

  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      // 1. Kiểm tra session với Timeout an toàn từ authService
      const { session } = await authService.getSession()

      if (!mounted) return

      if (session) {
        // Đã đăng nhập -> Chuyển hướng ngay
        router.replace(nextUrl)
      } else {
        // Chưa đăng nhập -> Tắt loading để hiện Form
        setIsChecking(false)
      }
    }

    checkSession()

    // 2. Lắng nghe sự kiện login thành công (từ AuthForm hoặc OAuth)
    const { data: authListener } = authService.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace(nextUrl)
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [router, nextUrl])

  // Màn hình chờ (Loading) - Màu đen trùng khớp với background
  if (isChecking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-black text-white font-sans">
      <div className="w-full max-w-md mx-4 px-6 py-8">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-full bg-green-500/10 mb-4">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent mb-2">
            Cổ Phiếu Lướt Sóng
          </h1>
          <p className="text-gray-400 text-sm">Đăng nhập để tiếp tục hành trình đầu tư</p>
        </div>

        {/* Form Component */}
        <AuthForm />
        
      </div>
    </div>
  )
}

// Bọc Suspense để tránh lỗi build khi dùng useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <LoginContent />
    </Suspense>
  )
}
