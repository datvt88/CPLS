'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Session, User } from '@supabase/supabase-js'

interface UseSessionReturn {
  session: Session | null
  user: User | null
  loading: boolean
  isAuthenticated: boolean
}

/**
 * Custom hook to get current session and user
 * Automatically updates when auth state changes
 */
export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession()

        if (mounted) {
          setSession(initialSession)
          setUser(initialSession?.user ?? null)
          setLoading(false)
        }
      } catch (error) {
        console.error('Error getting session:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (mounted) {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    user,
    loading,
    isAuthenticated: !!session && !!user,
  }
}

/**
 * Hook to check if user is authenticated
 * Returns boolean and loading state
 */
export function useAuth(): { isAuthenticated: boolean; loading: boolean } {
  const { isAuthenticated, loading } = useSession()
  return { isAuthenticated, loading }
}
