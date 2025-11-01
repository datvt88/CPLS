'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
          }, { onConflict: 'id' })
        }
      }catch(e){ console.error('profile upsert error', e) }
    })
    return ()=>{ mounted=false; sub.subscription.unsubscribe() }
  },[])
  return null
}
