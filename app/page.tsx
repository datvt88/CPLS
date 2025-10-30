'use client'
import { AuthForm } from '@/components/AuthForm'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Check or create profile
          const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching profile:', fetchError)
          }

          if (!existingProfile) {
            const { error: insertError } = await supabase.from('profiles').insert([
              {
                id: session.user.id,
                email: session.user.email,
                role: 'user',
                plan: 'Free',
                created_at: new Date().toISOString(),
              },
            ])

            if (insertError) {
              console.error('Error creating profile:', insertError)
            }
          }

          router.push('/dashboard')
        } catch (error) {
          console.error('Error in auth flow:', error)
        }
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  if (loading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      </main>
    )
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-zinc-900 via-black to-zinc-900">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-2xl p-8 border border-zinc-800">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
            Auto Trading AI
          </h1>
          <p className="text-gray-400 text-sm">
            AI-powered trading signals for smart investors
          </p>
        </div>
        <AuthForm />
      </div>
    </main>
  )
}
