import { supabase } from '@/lib/supabaseClient'

export interface AuthCredentials {
  email: string
  password: string
}

export const authService = {
  /**
   * Sign up a new user
   */
  async signUp({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  },

  /**
   * Sign in with email and password
   */
  async signIn({ email, password }: AuthCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  },

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    return { session: data.session, error }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}
