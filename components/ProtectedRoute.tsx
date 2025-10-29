'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ProtectedRoute({ children, requireVIP = false }: { children: React.ReactNode, requireVIP?: boolean }){
  const [allowed, setAllowed] = useState(false)
  const router = useRouter()

  useEffect(()=>{
    (async ()=>{
      const { data: { session } } = await supabase.auth.getSession()
      if(!session) return router.push('/login')
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      if(!requireVIP || profile?.role === 'vip') setAllowed(true)
      else router.push('/upgrade')
    })()
  },[])

  if(!allowed) return null
  return <>{children}</>
}
