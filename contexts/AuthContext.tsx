'use client'

/**
 * AuthContext - Centralized Authentication Context
 * 
 * Manages authentication state and provides auth methods.
 * Works alongside PermissionsContext for RBAC.
 * 
 * Following Google's authentication best practices:
 * - Single source of truth for auth state
 * - Reactive updates via onAuthStateChange
 * - Proper error handling
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authService } from '@/services/auth.service'
import type { User, Session } from '@supabase/supabase-js'

// ============================================================================
// Types
// ============================================================================

interface AuthResult {
  error: Error | null
}

interface AuthContextValue {
  // State
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Auth Methods
  signIn: (email: string, password: string) => Promise<AuthResult>
  signInWithPhone: (phoneNumber: string, password: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
  
  // Helpers
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Default return value when AuthProvider is not found
const DEFAULT_AUTH_VALUE: AuthContextValue = {
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

// ============================================================================
// Provider
// ============================================================================

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
      } catch {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (isMounted) {
          setSession(newSession)
          setUser(newSession?.user ?? null)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ============================================================================
  // Auth Methods
  // ============================================================================

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await authService.signIn({ email, password })
      return { error: error ? new Error(error.message) : null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signInWithPhone = useCallback(async (phoneNumber: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await authService.signInWithPhone({ phoneNumber, password })
      return { error: error ? new Error(error.message) : null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await authService.signInWithGoogle()
      return { error: error ? new Error(error.message) : null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await authService.signUp({ email, password })
      return { error: error ? new Error(error.message) : null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Unknown error') }
    }
  }, [])

  const signOut = useCallback(async (): Promise<AuthResult> => {
    try {
      const { error } = await authService.signOut()
      if (error) {
        const message = error instanceof Error ? error.message : 
                       (typeof error === 'object' && error !== null && 'message' in error) 
                         ? String((error as { message: unknown }).message) 
                         : 'Đăng xuất thất bại'
        return { error: new Error(message) }
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
    } catch {
      // Silent failure - session refresh errors are expected when not authenticated
    }
  }, [])

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<AuthContextValue>(() => ({
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

// ============================================================================
// Hook
// ============================================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    console.warn('[useAuth] Called outside of AuthProvider')
    return DEFAULT_AUTH_VALUE
  }
  
  return context
}
