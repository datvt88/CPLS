import { createClient, SupabaseClient } from '@supabase/supabase-js'

/* -------------------------------------------------
   LAZY INITIALIZATION - Allows build without env vars
   but throws error when actually used without config
--------------------------------------------------*/
let _supabase: SupabaseClient | null = null

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    throw new Error(
      '❌ Missing NEXT_PUBLIC_SUPABASE_URL — Please add it in Vercel → Environment Variables'
    )
  }

  if (!supabaseAnonKey || !supabaseAnonKey.startsWith('eyJ')) {
    throw new Error(
      '❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY — Must be a JWT starting with "eyJ"'
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}

/* -------------------------------------------------
   COOKIE STORAGE — runs safely on server & client
   Improved sync between cookie and localStorage with mutex lock
   to prevent race conditions during concurrent writes.
   
   Now supports chunking for large values (> 3KB) to work with
   @supabase/ssr middleware which reads cookies.
--------------------------------------------------*/

// Max cookie size (leaving room for name and other attributes)
const MAX_COOKIE_SIZE = 3500

class CookieAuthStorage {
  private storageKey: string
  private lastSyncTime: number = 0
  private readonly SYNC_INTERVAL = 10000 // Increased to 10 seconds to reduce conflicts
  private isWriting: boolean = false // Mutex lock to prevent concurrent writes

  constructor(key = 'cpls-auth-token') {
    this.storageKey = key
  }

  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      // If currently writing, read from localStorage (avoids read-during-write race)
      if (this.isWriting) {
        return localStorage.getItem(key)
      }
      
      // Prioritize localStorage (atomic and synchronous) over cookies (asynchronous)
      const localValue = localStorage.getItem(key)
      const cookieValue = this.getChunkedCookie(key)
      
      // Nếu cả hai đều có, ưu tiên giá trị mới nhất (có thể so sánh timestamp nếu cần)
      // Trong trường hợp này, ưu tiên localStorage vì nó được cập nhật đồng bộ
      if (localValue) {
        // Chỉ sync cookie nếu khác và đã qua SYNC_INTERVAL
        const now = Date.now()
        const shouldSync = now - this.lastSyncTime > this.SYNC_INTERVAL
        
        if (shouldSync && cookieValue !== localValue) {
          try {
            this.setChunkedCookie(key, localValue, 30)
            this.lastSyncTime = now
          } catch { /* ignore */ }
        }
        return localValue
      }
      
      // Nếu không có localStorage nhưng có cookie -> khôi phục localStorage
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
    
    // Set mutex để tránh concurrent writes
    this.isWriting = true
    
    try {
      // Lưu vào localStorage trước (atomic và nhanh hơn)
      localStorage.setItem(key, value)
      
      // Sau đó lưu vào cookie với chunking (để middleware có thể đọc)
      this.setChunkedCookie(key, value, 30)
      
      this.lastSyncTime = Date.now()
    } catch (e) {
      // Log lỗi nhưng không crash
      console.warn('[CookieAuthStorage] Error saving auth data:', e)
    } finally {
      // Release mutex
      this.isWriting = false
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return
    
    this.isWriting = true
    
    try {
      localStorage.removeItem(key)
      this.deleteChunkedCookie(key)
    } catch {
      /* ignore */
    } finally {
      this.isWriting = false
    }
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    try {
      const nameEQ = name + '='
      const ca = document.cookie.split(';')
      for (let c of ca) {
        while (c.charAt(0) === ' ') c = c.substring(1)
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length)
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
      const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `${name}=${value}${expires}; path=/${secure}; SameSite=Lax`
    } catch (e) {
      console.warn('[CookieAuthStorage] Error setting cookie:', e)
    }
  }

  private deleteCookie(name: string) {
    if (typeof document === 'undefined') return
    try {
      document.cookie = `${name}=; Max-Age=-999999; path=/`
    } catch { /* ignore */ }
  }

  /**
   * Get value from chunked cookies
   * Handles both single cookie and chunked cookies (for values > MAX_COOKIE_SIZE)
   */
  private getChunkedCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    try {
      // First try to get a single cookie
      const singleValue = this.getCookie(name)
      if (singleValue) return singleValue

      // Try to reassemble chunked cookies
      let value = ''
      let chunkIndex = 0
      
      while (true) {
        const chunkName = `${name}.${chunkIndex}`
        const chunk = this.getCookie(chunkName)
        if (!chunk) break
        value += chunk
        chunkIndex++
      }
      
      return value || null
    } catch {
      return null
    }
  }

  /**
   * Set value as chunked cookies if it's too large for a single cookie
   * This ensures compatibility with @supabase/ssr middleware
   */
  private setChunkedCookie(name: string, value: string, days: number): void {
    if (typeof document === 'undefined') return
    
    try {
      // First, clean up any existing chunks and the main cookie
      this.deleteChunkedCookie(name)
      
      // If value fits in a single cookie, store it directly
      if (value.length <= MAX_COOKIE_SIZE) {
        this.setCookie(name, value, days)
        return
      }
      
      // Store chunks directly without intermediate array
      let chunkIndex = 0
      for (let i = 0; i < value.length; i += MAX_COOKIE_SIZE) {
        const chunk = value.slice(i, i + MAX_COOKIE_SIZE)
        this.setCookie(`${name}.${chunkIndex}`, chunk, days)
        chunkIndex++
      }
    } catch (e) {
      console.warn('[CookieAuthStorage] Error setting chunked cookie:', e)
    }
  }

  /**
   * Delete chunked cookies and main cookie
   * Uses MAX_CHUNKS_TO_DELETE constant for cleanup iterations
   */
  private deleteChunkedCookie(name: string): void {
    if (typeof document === 'undefined') return
    try {
      // Delete the main cookie
      this.deleteCookie(name)
      
      // Delete all possible chunks
      // JWT tokens are typically ~2-4KB, so 10 chunks (35KB) is more than enough
      const MAX_CHUNKS_TO_DELETE = 10
      for (let i = 0; i < MAX_CHUNKS_TO_DELETE; i++) {
        this.deleteCookie(`${name}.${i}`)
      }
    } catch { /* ignore */ }
  }
}

const cookieStorage = new CookieAuthStorage()

/* -------------------------------------------------
   GET SUPABASE CLIENT — Lazy initialization
--------------------------------------------------*/
function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage:
        typeof window !== 'undefined'
          ? {
              getItem: (key) => cookieStorage.getItem(key),
              setItem: (key, value) => cookieStorage.setItem(key, value),
              removeItem: (key) => cookieStorage.removeItem(key),
            }
          : undefined,
      storageKey: 'cpls-auth-token',
    },
    global: {
      headers: {
        'x-application-name': 'CPLS',
      },
    },
  })

  return _supabase
}

/* -------------------------------------------------
   EXPORT - Proxy object for lazy access
--------------------------------------------------*/
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})

/* -------------------------------------------------
   AUTH HELPERS
--------------------------------------------------*/
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    return !!data.session
  } catch (err) {
    console.error('Auth error:', err)
    return false
  }
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    return data.user
  } catch (err) {
    console.error('Error getting user:', err)
    return null
  }
}

export async function refreshSession() {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw error
    return data.session
  } catch (err) {
    console.error('Error refreshing session:', err)
    return null
  }
}
