'use client'
import { useState } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
export default function SignalAI(){
  const user = useUser()
  const [prompt,setPrompt] = useState('VNINDEX')
  const [out,setOut] = useState<any>(null)
  const [loading,setLoading] = useState(false)
  const run = async ()=>{
    setLoading(true); setOut(null)
    const res = await fetch('/api/gemini',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ prompt, user_id: user?.id })})
    const j = await res.json(); setOut(j); setLoading(false)
  }
  return (
    <div>
      <input className="w-full p-2 rounded bg-[#0b1116] mb-2" value={prompt} onChange={e=>setPrompt(e.target.value)} />
      <button onClick={run} className="px-4 py-2 bg-purple-600 rounded text-white" disabled={loading}>{loading ? 'Running...' : 'Run AI'}</button>
      {out && (<div className="mt-3 p-3 bg-[#081018] rounded text-sm"><div className="inline-block px-3 py-1 rounded-md font-bold">{out.signal}</div><div className="mt-2">Confidence: {out.confidence}</div><div className="mt-2 whitespace-pre-line">{out.summary}</div></div>)}
    </div>
  )
}
