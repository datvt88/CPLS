import { supabase } from '@/lib/supabaseClient'

export interface AuthCredentials {
  email: string
  password: string
}

export interface ZaloAuthOptions {
  redirectTo?: string
  scopes?: string
}

export const authService = {
  /**
   * Sign up a new user with email and password
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
   * Sign in with phone number and password
   * Converts phone number to email, then authenticates with Supabase
   */
  async signInWithPhone({ phoneNumber, password }: { phoneNumber: string; password: string }) {
    try {
      // Lookup email by phone number
      const response = await fetch('/api/auth/signin-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { data: null, error: { message: data.error || 'Số điện thoại không tồn tại' } }
      }

      // Sign in with the retrieved email
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: password,
      })

      return { data: authData, error }
    } catch (err) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : 'Đã có lỗi xảy ra' }
      }
    }
  },

  /**
   * Sign in with Google OAuth
   * Uses Supabase's built-in Google OAuth provider
   */
  async signInWithGoogle(options?: { redirectTo?: string }) {
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })

    return { data, error }
  },

  /**
   * Sign in with Zalo OAuth
   * Requires Zalo OAuth to be configured in Supabase
   */
  async signInWithZalo(options?: ZaloAuthOptions) {
    const redirectTo = options?.redirectTo || `${window.location.origin}/auth/callback`
    const scopes = options?.scopes || 'id,name,picture,phone'

    // Using Supabase OAuth with custom provider
    // Note: This requires configuring a custom OAuth provider in Supabase
    // or using Supabase's third-party provider support
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'zalo' as any, // Custom provider
      options: {
        redirectTo,
        scopes,
        queryParams: {
          app_id: process.env.NEXT_PUBLIC_ZALO_APP_ID || '',
        },
      },
    })

    return { data, error }
  },

  /**
   * Handle OAuth callback
   * This should be called in the callback page after OAuth redirect
   */
  async handleOAuthCallback() {
    // Supabase automatically handles the OAuth callback
    // Just get the session which should be available after redirect
    const { data, error } = await supabase.auth.getSession()
    return { session: data.session, error }
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
   * Get current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser()
    return { user: data.user, error }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  },

  /**
   * Get user metadata (includes OAuth provider data)
   */
  async getUserMetadata() {
    const { user, error } = await this.getUser()
    if (error || !user) return { metadata: null, error }

    return {
      metadata: {
        email: user.email,
        fullName: user.user_metadata?.full_name || user.user_metadata?.name,
        avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        phoneNumber: user.user_metadata?.phone_number || user.user_metadata?.phone,
        provider: user.app_metadata?.provider,
        providerId: user.user_metadata?.sub || user.user_metadata?.provider_id,
      },
      error: null,
    }
  },
}
