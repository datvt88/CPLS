'use client'

import { AuthForm } from '@/components/AuthForm'

export default function LoginPage() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="w-full max-w-md mx-4">
        <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">CPLS</h1>
            <p className="text-gray-400 text-sm">
              Crypto Price Live Signal
            </p>
          </div>

          <AuthForm />

          <div className="mt-6 pt-6 border-t border-zinc-800">
            <p className="text-center text-xs text-gray-500">
              Nền tảng tín hiệu giao dịch crypto và cổ phiếu
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
