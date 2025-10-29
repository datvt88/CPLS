'use client'
import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function AuthListener(){
  useEffect(()=>{
    let mounted = true
    supabase.auth.getSession().then(()=>{})
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      try{
        const user = session?.user
        if(user && mounted){
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            role: 'user',
            created_at: new Date().toISOString()
          }, { onConflict: ['id'] })
        }
      }catch(e){ console.error('profile upsert error', e) }
    })
    return ()=>{ mounted=false; sub.subscription.unsubscribe() }
  },[])
  return null
}
