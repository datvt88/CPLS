'use client'
import { AuthForm } from '@/components/AuthForm'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function LoginPage() {
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
            Welcome Back
          </h1>
          <p className="text-gray-400 text-sm">
            Sign in to access your trading dashboard
          </p>
        </div>
        <AuthForm />
      </div>
    </main>
  )
}
