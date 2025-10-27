'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [ticker, setTicker] = useState('VNINDEX')
  const [signal, setSignal] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchSignal = async () => {
    const res = await fetch(`/api/ai-signal?ticker=${ticker}`)
    const data = await res.json()
    setSignal(data.signal)
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {user ? (
        <div>
          <p>Welcome, {user.email}</p>
          <p className="mt-2">Your subscription: <strong>{user.user_metadata?.plan || 'Free'}</strong></p>
          {user.user_metadata?.plan === 'VIP' ? (
            <div className="mt-6 p-4 bg-green-100 rounded-lg">
              <h2 className="font-semibold text-green-700 mb-2">AI Trading Signals</h2>
              <div className="flex gap-2 mb-3">
                <input value={ticker} onChange={e => setTicker(e.target.value)} className="border p-2 rounded w-40" placeholder="Enter ticker" />
                <button onClick={fetchSignal} className="bg-blue-600 text-white px-3 py-2 rounded">Get Signal</button>
              </div>
              {signal && <p className="bg-white p-3 rounded shadow">{signal}</p>}
            </div>
          ) : (
            <div className="mt-6 p-4 bg-yellow-100 rounded-lg">
              <p>Upgrade to VIP to access AI insights and trading filters.</p>
            </div>
          )}
        </div>
      ) : (
        <p>Please log in to view your dashboard.</p>
      )}
    </main>
  )
}