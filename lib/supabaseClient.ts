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
   Cải thiện sync giữa cookie và localStorage
--------------------------------------------------*/
class CookieAuthStorage {
  private storageKey: string
  private lastSyncTime: number = 0
  private readonly SYNC_INTERVAL = 5000 // Chỉ sync mỗi 5 giây

  constructor(key = 'cpls-auth-token') {
    this.storageKey = key
  }

  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      // Ưu tiên cookie trước (tin cậy hơn)
      const cookieValue = this.getCookie(key)
      const localValue = localStorage.getItem(key)
      
      // Chỉ sync nếu đã qua SYNC_INTERVAL kể từ lần sync trước
      const now = Date.now()
      const shouldSync = now - this.lastSyncTime > this.SYNC_INTERVAL
      
      if (cookieValue) {
        // Nếu có cookie nhưng localStorage khác -> sync lại localStorage
        if (shouldSync && localValue !== cookieValue) {
          try {
            localStorage.setItem(key, cookieValue)
            this.lastSyncTime = now
          } catch { /* ignore */ }
        }
        return cookieValue
      }
      
      // Nếu không có cookie nhưng có localStorage -> khôi phục cookie
      if (localValue) {
        if (shouldSync) {
          try {
            this.setCookie(key, localValue, 30)
            this.lastSyncTime = now
          } catch { /* ignore */ }
        }
        return localValue
      }
      
      return null
    } catch {
      return null
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return
    try {
      // Lưu vào cả cookie và localStorage để đảm bảo persistence
      this.setCookie(key, value, 30)
      localStorage.setItem(key, value)
    } catch (e) {
      // Log lỗi nhưng không crash
      console.warn('[CookieAuthStorage] Error saving auth data:', e)
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return
    try {
      this.deleteCookie(key)
      localStorage.removeItem(key)
    } catch {
      /* ignore */
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
