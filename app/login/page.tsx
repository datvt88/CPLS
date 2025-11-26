'use client'

import { AuthForm } from '@/components/AuthForm'

export default function LoginPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-black">
      <div className="w-full max-w-md mx-4 px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-8">
            Cổ Phiếu Lướt Sóng
          </h1>
        </div>

        <AuthForm />
      </div>
    </div>
  )
}
