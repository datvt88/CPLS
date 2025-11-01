'use client'
import { useState } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { SignalOutput, SignalResponse } from '@/types/signal'

export default function SignalAI(){
  const user = useUser()
  const [prompt, setPrompt] = useState('VNINDEX')
  const [out, setOut] = useState<SignalOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!prompt.trim()) {
      setError('Vui lòng nhập mã cổ phiếu')
      return
    }

    setLoading(true)
    setOut(null)
    setError(null)

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, user_id: user?.id })
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

  return (
    <div>
      <input
        className="w-full p-2 rounded bg-[#0b1116] mb-2 border border-gray-700 focus:outline-none focus:border-purple-500"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Nhập mã cổ phiếu (VD: VNINDEX, VNM, HPG)"
        disabled={loading}
      />
      <button
        onClick={run}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
        disabled={loading}
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
