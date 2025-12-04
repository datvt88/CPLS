'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'

interface FirebaseData {
  exists: boolean
  count?: number
  stocks?: string[]
  data?: any
  message?: string
}

function GoldenCrossAdminContent() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [firebaseData, setFirebaseData] = useState<FirebaseData | null>(null)

  useEffect(() => {
    checkData()
  }, [])

  const checkData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/seed-golden-cross')
      const data = await response.json()

      if (response.ok) {
        setFirebaseData(data)
      } else {
        setMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('Error checking Firebase data')
    } finally {
      setLoading(false)
    }
  }

  const seedData = async () => {
    try {
      setLoading(true)
      setMessage('')

      const response = await fetch('/api/admin/seed-golden-cross', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message} (${data.count} stocks)`)
        await checkData()
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error seeding data')
    } finally {
      setLoading(false)
    }
  }

  const clearData = async () => {
    if (!confirm('Bạn có chắc muốn xóa tất cả dữ liệu Golden Cross?')) {
      return
    }

    try {
      setLoading(true)
      setMessage('')

      const response = await fetch('/api/admin/seed-golden-cross', {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ ${data.message}`)
        await checkData()
      } else {
        setMessage(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error clearing data')
    } finally {
      setLoading(false)
    }
  }

  const testAPI = async () => {
    try {
      setLoading(true)
      setMessage('Testing API endpoint...')

      const response = await fetch('/api/signals/golden-cross?limit=5')
      const data = await response.json()

      if (response.ok) {
        setMessage(`✅ API works! Found ${data.total} analyzed stocks`)
        console.log('API Response:', data)
      } else {
        setMessage(`❌ API Error: ${data.error}`)
      }
    } catch (error) {
      setMessage('❌ Error testing API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[--bg] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[--fg] mb-2">
            Golden Cross Admin Panel
          </h1>
          <p className="text-[--muted]">
            Quản lý dữ liệu Golden Cross trong Firebase Realtime Database
          </p>
        </div>

        {/* Current Status */}
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-[--fg]">Trạng thái Firebase</h2>
            <button
              onClick={checkData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50"
            >
              🔄 Refresh
            </button>
          </div>

          {loading && !firebaseData ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[--muted]">Đang kiểm tra...</p>
            </div>
          ) : firebaseData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full ${
                    firebaseData.exists ? 'bg-green-500' : 'bg-red-500'
                  }`}
                ></div>
                <span className="text-[--fg] font-medium">
                  {firebaseData.exists
                    ? `✅ Có dữ liệu (${firebaseData.count} cổ phiếu)`
                    : '❌ Chưa có dữ liệu'}
                </span>
              </div>

              {firebaseData.exists && firebaseData.stocks && (
                <div className="bg-[--bg] p-4 rounded-lg border border-gray-700">
                  <p className="text-[--muted] text-sm mb-2">Danh sách cổ phiếu:</p>
                  <div className="flex flex-wrap gap-2">
                    {firebaseData.stocks.map((ticker) => (
                      <span
                        key={ticker}
                        className="px-3 py-1 bg-purple-600/20 text-purple-400 rounded-full text-sm font-mono"
                      >
                        {ticker}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!firebaseData.exists && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Chưa có dữ liệu Golden Cross trong Firebase. Hãy seed dữ liệu demo để test.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800 mb-6">
          <h2 className="text-xl font-bold text-[--fg] mb-4">Hành động</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Seed Data */}
            <button
              onClick={seedData}
              disabled={loading}
              className="p-6 rounded-xl border-2 border-green-600 bg-green-600/10 hover:bg-green-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-[--fg] font-bold mb-1">Seed Demo Data</h3>
                  <p className="text-[--muted] text-sm">Thêm 10 cổ phiếu demo</p>
                </div>
              </div>
            </button>

            {/* Clear Data */}
            <button
              onClick={clearData}
              disabled={loading}
              className="p-6 rounded-xl border-2 border-red-600 bg-red-600/10 hover:bg-red-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-[--fg] font-bold mb-1">Clear Data</h3>
                  <p className="text-[--muted] text-sm">Xóa tất cả dữ liệu</p>
                </div>
              </div>
            </button>

            {/* Test API */}
            <button
              onClick={testAPI}
              disabled={loading}
              className="p-6 rounded-xl border-2 border-blue-600 bg-blue-600/10 hover:bg-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="text-[--fg] font-bold mb-1">Test API</h3>
                  <p className="text-[--muted] text-sm">Kiểm tra API endpoint</p>
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
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.includes('✅')
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : message.includes('⚠️')
                  ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              <p className="font-medium">{message}</p>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
          <h2 className="text-xl font-bold text-[--fg] mb-4">Quick Links</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <a
              href="/signals"
              className="p-4 bg-purple-600/10 hover:bg-purple-600/20 border border-purple-600/30 rounded-lg transition-all block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[--fg] font-bold">Tín hiệu AI</h3>
                  <p className="text-[--muted] text-sm">Xem Golden Cross signals</p>
                </div>
                <svg
                  className="w-5 h-5 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </a>

            <a
              href="/admin/test-premium"
              className="p-4 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/30 rounded-lg transition-all block"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[--fg] font-bold">Test Premium</h3>
                  <p className="text-[--muted] text-sm">Cấp quyền Premium</p>
                </div>
                <svg
                  className="w-5 h-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </a>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-blue-400 text-sm font-medium mb-2">
                📝 Hướng dẫn sử dụng:
              </p>
              <ol className="text-blue-200/80 text-sm space-y-1 list-decimal list-inside">
                <li>Click "Seed Demo Data" để thêm 10 cổ phiếu demo vào Firebase</li>
                <li>Click "Test API" để kiểm tra API endpoint hoạt động</li>
                <li>Vào "/signals" để xem Golden Cross widget (cần Premium)</li>
                <li>Click "Clear Data" để xóa dữ liệu khi test xong</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GoldenCrossAdminPage() {
  return (
    <ProtectedRoute>
      <GoldenCrossAdminContent />
    </ProtectedRoute>
  )
}
