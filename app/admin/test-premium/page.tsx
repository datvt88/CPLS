'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/components/ProtectedRoute'

interface MembershipStatus {
  userId: string
  email: string
  membership: string
  expiresAt?: string
  isPremium: boolean
  status: string
}

function TestPremiumContent() {
  const router = useRouter()
  const [status, setStatus] = useState<MembershipStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/grant-premium')
      const data = await response.json()

      if (response.ok) {
        setStatus(data)
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('Error checking status')
    } finally {
      setLoading(false)
    }
  }

  const grantPremium = async () => {
    try {
      setLoading(true)
      setMessage('')

      const response = await fetch('/api/admin/grant-premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ durationDays: 365 }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        await checkStatus()

        // Refresh page after 1 second to apply premium access
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error granting premium')
    } finally {
      setLoading(false)
    }
  }

  const removePremium = async () => {
    try {
      setLoading(true)
      setMessage('')

      const response = await fetch('/api/admin/grant-premium', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        await checkStatus()

        // Refresh page after 1 second
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error removing premium')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-[--bg] p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[--fg] mb-2">
            Test Premium Membership
          </h1>
          <p className="text-[--muted]">
            Cấp quyền Premium tạm thời để test tính năng
          </p>
        </div>

        {/* Current Status */}
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 mb-6">
          <h2 className="text-xl font-bold text-[--fg] mb-4">Trạng thái hiện tại</h2>

          {loading && !status ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[--muted]">Đang kiểm tra...</p>
            </div>
          ) : status ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[--muted]">Email:</span>
                <span className="text-[--fg] font-medium">{status.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[--muted]">User ID:</span>
                <span className="text-[--fg] font-mono text-sm">{status.userId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[--muted]">Membership:</span>
                <span className={`font-bold ${status.isPremium ? 'text-purple-400' : 'text-gray-400'}`}>
                  {status.membership.toUpperCase()}
                </span>
              </div>
              {status.expiresAt && (
                <div className="flex justify-between items-center">
                  <span className="text-[--muted]">Hết hạn:</span>
                  <span className="text-[--fg]">{formatDate(status.expiresAt)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="text-[--muted]">Trạng thái:</span>
                <span className={`font-bold text-lg ${status.isPremium ? 'text-green-400' : 'text-yellow-400'}`}>
                  {status.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[--muted]">Không thể tải trạng thái</p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 mb-6">
          <h2 className="text-xl font-bold text-[--fg] mb-4">Hành động</h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Grant Premium Button */}
            <button
              onClick={grantPremium}
              disabled={loading || status?.isPremium}
              className={`p-6 rounded-xl border-2 transition-all ${
                status?.isPremium
                  ? 'border-gray-700 bg-gray-800/50 cursor-not-allowed opacity-50'
                  : 'border-purple-600 bg-purple-600/10 hover:bg-purple-600/20 hover:border-purple-500'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-[--fg] font-bold mb-1">Cấp Premium</h3>
                  <p className="text-[--muted] text-sm">1 năm (365 ngày)</p>
                </div>
              </div>
            </button>

            {/* Remove Premium Button */}
            <button
              onClick={removePremium}
              disabled={loading || !status?.isPremium}
              className={`p-6 rounded-xl border-2 transition-all ${
                !status?.isPremium
                  ? 'border-gray-700 bg-gray-800/50 cursor-not-allowed opacity-50'
                  : 'border-red-600 bg-red-600/10 hover:bg-red-600/20 hover:border-red-500'
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-[--fg] font-bold mb-1">Hủy Premium</h3>
                  <p className="text-[--muted] text-sm">Trở về Free</p>
                </div>
              </div>
            </button>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="mt-4 text-center">
              <div className="inline-block w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[--muted] text-sm mt-2">Đang xử lý...</p>
            </div>
          )}

          {/* Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.includes('✅')
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              <p className="text-center font-medium">{message}</p>
            </div>
          )}
        </div>

        {/* Test Links */}
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-[--fg] mb-4">Test Premium Features</h2>
          <div className="space-y-3">
            <a
              href="/signals"
              className="block p-4 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-600/30 rounded-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[--fg] font-bold">Tín hiệu AI</h3>
                  <p className="text-[--muted] text-sm">Golden Cross signals với Gemini AI</p>
                </div>
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>

            <a
              href="/dashboard"
              className="block p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 rounded-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[--fg] font-bold">Dashboard</h3>
                  <p className="text-[--muted] text-sm">Premium dashboard features</p>
                </div>
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </a>
          </div>
        </div>

        {/* Note */}
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Chú ý</p>
              <p className="text-yellow-200/80 text-sm">
                Đây là tính năng test. Premium membership sẽ được cấp tạm thời cho mục đích phát triển và kiểm thử.
                Trong production, membership sẽ được quản lý qua hệ thống thanh toán và admin panel.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TestPremiumPage() {
  return (
    <ProtectedRoute>
      <TestPremiumContent />
    </ProtectedRoute>
  )
}
