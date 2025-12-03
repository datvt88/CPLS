import { createClient } from '@supabase/supabase-js'

// Get environment variables with fallback for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

// Validate environment variables
const hasValidUrl = supabaseUrl && !supabaseUrl.includes('placeholder') && supabaseUrl.startsWith('https://')
const hasValidKey = supabaseAnonKey && !supabaseAnonKey.includes('placeholder') && supabaseAnonKey.startsWith('eyJ')

// Log warnings for missing/invalid env vars
if (typeof window !== 'undefined') {
  // Client-side validation
  if (!hasValidUrl) {
    console.error('❌ [Supabase] NEXT_PUBLIC_SUPABASE_URL is missing or invalid')
    console.error('   Please check:')
    console.error('   1. Vercel: Settings → Environment Variables')
    console.error('   2. Local: Create .env.local file (see SETUP_INSTRUCTIONS.md)')
    console.error('   3. After updating, redeploy or restart dev server')
  }
  if (!hasValidKey) {
    console.error('❌ [Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing or invalid')
    console.error('   Expected JWT token starting with "eyJ"')
  }

  // Log success for debugging
  if (hasValidUrl && hasValidKey) {
    console.log('✅ [Supabase] Environment variables loaded successfully')
  }
} else {
  // Server-side validation
  if (!hasValidUrl || !hasValidKey) {
    console.error('❌ [Supabase] Missing or invalid environment variables on server')
    console.error('   URL valid:', hasValidUrl)
    console.error('   Key valid:', hasValidKey)
  }
}

/**
 * Custom storage adapter that uses both cookies and localStorage
 * Cookies provide better security and SSR support
 * localStorage provides fallback
 */
class CookieStorage {
  private storageKey: string

  constructor(storageKey: string = 'cpls-auth-token') {
    this.storageKey = storageKey
  }

  // Get item from cookie or localStorage
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null

    try {
      // Try to get from cookie first
      const cookieValue = this.getCookie(key)
      if (cookieValue) return cookieValue

      // Fallback to localStorage
      return localStorage.getItem(key)
    } catch (error) {
      console.error('Error getting item from storage:', error)
      return null
    }
  }

  // Set item to both cookie and localStorage
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return

    try {
      // Set to cookie with 30 days expiry (for refresh token)
      // Note: Access token (JWT) expires based on Supabase settings (8 hours by default)
      // Refresh token allows getting new access tokens without re-login for 30 days
      this.setCookie(key, value, 30)

      // Also set to localStorage as backup
      localStorage.setItem(key, value)
    } catch (error) {
      console.error('Error setting item to storage:', error)
    }
  }

  // Remove item from both cookie and localStorage
  removeItem(key: string): void {
    if (typeof window === 'undefined') return

    try {
      // Remove from cookie
      this.deleteCookie(key)

      // Remove from localStorage
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error removing item from storage:', error)
    }
  }

  // Get cookie value
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null

    const nameEQ = name + '='
    const ca = document.cookie.split(';')

    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
    }

    return null
  }

  // Set cookie with expiry
  private setCookie(name: string, value: string, days: number): void {
    if (typeof document === 'undefined') return

    let expires = ''
    if (days) {
      const date = new Date()
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
      expires = '; expires=' + date.toUTCString()
    }

    // Set cookie with SameSite and Secure flags
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = name + '=' + (value || '') + expires + '; path=/' + secure + '; SameSite=Lax'
  }

  // Delete cookie
  private deleteCookie(name: string): void {
    if (typeof document === 'undefined') return
    document.cookie = name + '=; Max-Age=-99999999; path=/'
  }
}

// Create custom storage instance
const cookieStorage = new CookieStorage('cpls-auth-token')

// Export validation status for runtime checks
export const supabaseConfig = {
  isConfigured: hasValidUrl && hasValidKey,
  hasValidUrl,
  hasValidKey,
  url: hasValidUrl ? supabaseUrl : null,
}

// Create singleton Supabase client with enhanced session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable session persistence
    persistSession: true,

    // Auto refresh token before expiry
    autoRefreshToken: true,

    // Use custom cookie storage
    storage: typeof window !== 'undefined' ? cookieStorage : undefined,

    // Storage key for auth tokens
    storageKey: 'cpls-auth-token',

    // Detect session in URL (for OAuth callbacks)
    detectSessionInUrl: true,

    // Flow type for PKCE (more secure)
    flowType: 'pkce',
  },
  // Global options
  global: {
    headers: {
      'x-application-name': 'CPLS',
    },
  },
})

/**
 * Helper function to check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
  } catch (error) {
    console.error('Error checking authentication:', error)
    return false
  }
}

/**
 * Helper function to get current user
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Helper function to refresh session
 */
export async function refreshSession() {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    if (error) throw error
    return session
  } catch (error) {
    console.error('Error refreshing session:', error)
    return null
  }
}
