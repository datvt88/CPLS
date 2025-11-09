'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { SignalOutput, SignalResponse } from '@/types/signal'

interface ApiStatus {
  status: 'success' | 'error' | 'checking'
  message: string
  configured: boolean
  available: boolean
}

export default function SignalAI(){
  const [userId, setUserId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('VNINDEX')
  const [out, setOut] = useState<SignalOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    status: 'checking',
    message: 'Đang kiểm tra kết nối...',
    configured: false,
    available: false,
  })

  // Check API health on mount
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const res = await fetch('/api/gemini/health')
        const data = await res.json()

        setApiStatus({
          status: data.status,
          message: data.message,
          configured: data.configured,
          available: data.available,
        })
      } catch (err) {
        setApiStatus({
          status: 'error',
          message: 'Không thể kiểm tra kết nối',
          configured: false,
          available: false,
        })
      }
    }

    checkApiHealth()
    // Refresh status every 60 seconds
    const interval = setInterval(checkApiHealth, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user?.id || null)
    }
    getUser()
  }, [])

  const run = async () => {
    if (!prompt.trim()) {
      setError('Vui lòng nhập mã chỉ số (VNINDEX, VN30, VN30F1M, VN30F2M)')
      return
    }

    setLoading(true)
    setOut(null)
    setError(null)

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, user_id: userId })
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data: SignalResponse = await res.json()

      if ('error' in data) {
        setError(data.error)
      } else {
        setOut(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi gọi API')
    } finally {
      setLoading(false)
    }
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return 'bg-green-600 text-white'
      case 'SELL':
        return 'bg-red-600 text-white'
      case 'HOLD':
        return 'bg-yellow-600 text-white'
      default:
        return 'bg-gray-600 text-white'
    }
  }

  const getStatusColor = () => {
    if (apiStatus.status === 'checking') return 'bg-yellow-500'
    if (apiStatus.available) return 'bg-green-500'
    return 'bg-red-500'
  }

  const getStatusIcon = () => {
    if (apiStatus.status === 'checking') return '🔄'
    if (apiStatus.available) return '✓'
    return '✗'
  }

  return (
    <div>
      {/* API Connection Status */}
      <div className="mb-3 flex items-center gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${apiStatus.status === 'checking' ? 'animate-pulse' : ''}`}></div>
          <span className="text-gray-400">
            {getStatusIcon()} {apiStatus.message}
          </span>
        </div>
        {!apiStatus.available && apiStatus.configured && (
          <a
            href="/TROUBLESHOOTING_404.md"
            target="_blank"
            className="text-purple-400 hover:text-purple-300 underline ml-auto"
          >
            Xem hướng dẫn
          </a>
        )}
      </div>

      <input
        className="w-full p-2 rounded bg-[#0b1116] mb-2 border border-gray-700 focus:outline-none focus:border-purple-500"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Nhập mã chỉ số (VD: VNINDEX, VN30, VN30F1M, VN30F2M)"
        disabled={loading || !apiStatus.available}
      />
      <button
        onClick={run}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
        disabled={loading || !apiStatus.available}
      >
        {loading ? 'Đang phân tích...' : 'Phân tích AI'}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {out && (
        <div className="mt-3 p-3 bg-[#081018] rounded text-sm border border-gray-700">
          <div className={`inline-block px-3 py-1 rounded-md font-bold ${getSignalColor(out.signal)}`}>
            {out.signal}
          </div>
          <div className="mt-2">
            <span className="text-gray-400">Độ tin cậy:</span>{' '}
            <span className="font-semibold">{out.confidence}%</span>
          </div>
          <div className="mt-2 whitespace-pre-line text-gray-300">{out.summary}</div>
        </div>
      )}
    </div>
  )
}
