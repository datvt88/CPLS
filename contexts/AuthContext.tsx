'use client'

/**
 * AuthContext - Centralized Authentication Context
 * 
 * This context manages authentication state and provides auth methods.
 * It works alongside PermissionsContext for RBAC.
 * 
 * Features:
 * - Authentication state management (user, session)
 * - Login/Logout methods
 * - Auth state change listener
 * - OAuth support (Google, Zalo)
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import type { User, Session } from '@supabase/supabase-js'

// --- Types ---
interface AuthContextValue {
  // State
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Auth Methods
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithPhone: (phoneNumber: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  
  // Helpers
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// --- Provider ---
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initRef = useRef(false)

  // Initialize auth state
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    let isMounted = true

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        
        if (isMounted) {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[AuthContext] Init error:', error)
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(`[AuthContext] Auth event: ${event}`)
        
        if (isMounted) {
          setSession(newSession)
          setUser(newSession?.user ?? null)
          
          if (event === 'SIGNED_OUT') {
            setUser(null)
            setSession(null)
          }
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // --- Auth Methods ---

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await authService.signIn({ email, password })
      if (error) {
        return { error: new Error(error.message) }
      }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signInWithPhone = useCallback(async (phoneNumber: string, password: string) => {
    try {
      const { error } = await authService.signInWithPhone({ phoneNumber, password })
      if (error) {
        return { error: new Error(error.message) }
      }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await authService.signInWithGoogle()
      if (error) {
        return { error: new Error(error.message) }
      }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await authService.signUp({ email, password })
      if (error) {
        return { error: new Error(error.message) }
      }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const { error } = await authService.signOut()
      if (error) {
        return { error: error instanceof Error ? error : new Error('Unknown error') }
      }
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()
      setSession(refreshedSession)
      setUser(refreshedSession?.user ?? null)
    } catch (error) {
      console.error('[AuthContext] Refresh session error:', error)
    }
  }, [])

  // --- Context Value ---
  const value = useMemo(() => ({
    user,
    session,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signInWithPhone,
    signInWithGoogle,
    signUp,
    signOut,
    refreshSession,
  }), [user, session, isLoading, signIn, signInWithPhone, signInWithGoogle, signUp, signOut, refreshSession])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// --- Hook ---
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    console.warn('[useAuth] Called outside of AuthProvider')
    return {
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      signIn: async () => ({ error: new Error('AuthProvider not found') }),
      signInWithPhone: async () => ({ error: new Error('AuthProvider not found') }),
      signInWithGoogle: async () => ({ error: new Error('AuthProvider not found') }),
      signUp: async () => ({ error: new Error('AuthProvider not found') }),
      signOut: async () => ({ error: new Error('AuthProvider not found') }),
      refreshSession: async () => {},
    }
  }
  return context
}
