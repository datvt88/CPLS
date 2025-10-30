'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function AuthListener() {
  useEffect(() => {
    let mounted = true

    // Initialize session
    supabase.auth.getSession().then(() => {})

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      try {
        const user = session?.user

        if (user) {
          // Upsert user profile
          const { error } = await supabase.from('profiles').upsert(
            {
              id: user.id,
              email: user.email,
              role: 'user',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'id',
              ignoreDuplicates: false,
            }
          )

          if (error) {
            console.error('Profile upsert error:', error)
          }
        }

        // Handle different auth events
        if (event === 'SIGNED_OUT') {
          // Clear any local state if needed
          console.log('User signed out')
        }
      } catch (error) {
        console.error('AuthListener error:', error)
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  return null
}
