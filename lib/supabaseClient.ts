import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, COOKIE_EXPIRY_DAYS, AUTH_SYNC_INTERVAL } from '@/lib/auth/constants'

// ============================================================================
// Lazy Initialization
// Allows build without env vars but throws error when actually used
// ============================================================================

let _supabase: SupabaseClient | null = null

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL — Please add it in Vercel → Environment Variables'
    )
  }

  if (!supabaseAnonKey || !supabaseAnonKey.startsWith('eyJ')) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY — Must be a JWT starting with "eyJ"'
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

// ============================================================================
// Auth Storage
// Custom storage implementation that syncs between localStorage and cookies
// for cross-tab session persistence
// ============================================================================

class AuthStorage {
  private lastSyncTime: number = 0
  private isWriting: boolean = false

  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    
    try {
      // During writes, read from localStorage to avoid race conditions
      if (this.isWriting) {
        return localStorage.getItem(key)
      }
      
      // Prioritize localStorage (synchronous) over cookies
      const localValue = localStorage.getItem(key)
      const cookieValue = this.getCookie(key)
      
      if (localValue) {
        // Sync to cookie if needed
        this.syncToCookie(key, localValue, cookieValue)
        return localValue
      }
      
      // Restore from cookie if localStorage is empty
      if (cookieValue) {
        try {
          localStorage.setItem(key, cookieValue)
          this.lastSyncTime = Date.now()
        } catch { /* ignore */ }
        return cookieValue
      }
      
      return null
    } catch {
      return null
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return
    
    this.isWriting = true
    
    try {
      // Write to localStorage first (faster, atomic)
      localStorage.setItem(key, value)
      // Backup to cookie
      this.setCookie(key, value, COOKIE_EXPIRY_DAYS)
      this.lastSyncTime = Date.now()
    } catch (e) {
      console.warn('[AuthStorage] Error saving auth data:', e)
    } finally {
      this.isWriting = false
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return
    
    this.isWriting = true
    
    try {
      localStorage.removeItem(key)
      this.deleteCookie(key)
    } catch { /* ignore */ } 
    finally {
      this.isWriting = false
    }
  }

  private syncToCookie(key: string, localValue: string, cookieValue: string | null): void {
    const now = Date.now()
    const shouldSync = now - this.lastSyncTime > AUTH_SYNC_INTERVAL
    
    if (shouldSync && cookieValue !== localValue) {
      try {
        this.setCookie(key, localValue, COOKIE_EXPIRY_DAYS)
        this.lastSyncTime = now
      } catch { /* ignore */ }
    }
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    
    try {
      const nameEQ = name + '='
      const cookies = document.cookie.split(';')
      
      for (let cookie of cookies) {
        cookie = cookie.trim()
        if (cookie.indexOf(nameEQ) === 0) {
          return cookie.substring(nameEQ.length)
        }
      }
      return null
    } catch {
      return null
    }
  }

  private setCookie(name: string, value: string, days: number): void {
    if (typeof document === 'undefined') return
    
    try {
      const date = new Date()
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
      const expires = `; expires=${date.toUTCString()}`
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${name}=${value}${expires}; path=/${secure}; SameSite=Lax`
    } catch (e) {
      console.warn('[AuthStorage] Error setting cookie:', e)
    }
  }

  private deleteCookie(name: string): void {
    if (typeof document === 'undefined') return
    
    try {
      document.cookie = `${name}=; Max-Age=-999999; path=/`
    } catch { /* ignore */ }
  }
}

const authStorage = new AuthStorage()

// ============================================================================
// Supabase Client
// Using lazy initialization with proxy for optimal bundle size
// ============================================================================

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // Following Google's OAuth best practices
      storage: typeof window !== 'undefined'
        ? {
            getItem: (key) => authStorage.getItem(key),
            setItem: (key, value) => authStorage.setItem(key, value),
            removeItem: (key) => authStorage.removeItem(key),
          }
        : undefined,
      storageKey: AUTH_STORAGE_KEY,
    },
    global: {
      headers: {
        'x-application-name': 'CPLS',
      },
    },
  })

  return _supabase
}

// Proxy object for lazy access
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    return !!data.session
  } catch {
    return false
  }
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  } catch {
    return null
  }
}

/**
 * Refresh the current session
 */
export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw error
    return data.session
  } catch {
    return null
  }
}
