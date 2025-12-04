'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { AuthForm } from '@/components/AuthForm'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Kiểm tra xem user đã đăng nhập chưa
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        router.replace('/') // Nếu đã đăng nhập → về trang chủ
      }
    }

    checkSession()

    // Lắng nghe khi user login/logout
    const {
      data: authListener
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="flex justify-center items-center min-h-screen bg-black">
      <div className="w-full max-w-md mx-4 px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-8">
            Cổ Phiếu Lướt Sóng
          </h1>
        </div>

        {/* Form đăng nhập/đăng ký */}
        <AuthForm />
      </div>
    </div>
  )
}
