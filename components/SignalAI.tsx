'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { AISignal, SignalType } from '@/types'

export default function SignalAI() {
  const [userId, setUserId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('VNINDEX')
  const [out, setOut] = useState<AISignal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUserId(session.user.id)
      }
    }
    getUser()
  }, [])

  const run = async () => {
    setLoading(true)
    setOut(null)
    setError(null)

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, user_id: userId }),
      })

      if (!res.ok) {
        throw new Error('Failed to get AI signal')
      }

      const data = await res.json()
      setOut(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const getSignalColor = (signal: SignalType) => {
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
    <div className="space-y-3">
      <input
        className="w-full p-3 rounded-lg bg-[#0b1116] border border-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-600 transition"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter symbol (e.g., VNINDEX, AAPL)"
        disabled={loading}
      />
      <button
        onClick={run}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading}
      >
        {loading ? 'Analyzing...' : 'Run AI Analysis'}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {out && (
        <div className="mt-3 p-4 bg-[#081018] border border-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-block px-3 py-1 rounded-md font-bold text-sm ${getSignalColor(out.signal)}`}>
              {out.signal}
            </span>
            <span className="text-sm text-muted">
              Confidence: <span className="font-semibold text-white">{out.confidence}%</span>
            </span>
          </div>
          <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
            {out.summary}
          </div>
        </div>
      )}
    </div>
  )
}
