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
   Cải thiện sync giữa cookie và localStorage với mutex
--------------------------------------------------*/
class CookieAuthStorage {
  private storageKey: string
  private lastSyncTime: number = 0
  private readonly SYNC_INTERVAL = 10000 // Tăng lên 10 giây để giảm conflicts
  private isWriting: boolean = false // Mutex để tránh concurrent writes

  constructor(key = 'cpls-auth-token') {
    this.storageKey = key
  }

  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      // Nếu đang write thì chờ đợi từ localStorage trước
      if (this.isWriting) {
        return localStorage.getItem(key)
      }
      
      // Ưu tiên localStorage trước (ít race condition hơn cookie)
      const localValue = localStorage.getItem(key)
      const cookieValue = this.getCookie(key)
      
      // Nếu cả hai đều có, ưu tiên giá trị mới nhất (có thể so sánh timestamp nếu cần)
      // Trong trường hợp này, ưu tiên localStorage vì nó được cập nhật đồng bộ
      if (localValue) {
        // Chỉ sync cookie nếu khác và đã qua SYNC_INTERVAL
        const now = Date.now()
        const shouldSync = now - this.lastSyncTime > this.SYNC_INTERVAL
        
        if (shouldSync && cookieValue !== localValue) {
          try {
            this.setCookie(key, localValue, 30)
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
      
      // Sau đó lưu vào cookie (backup)
      this.setCookie(key, value, 30)
      
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
      this.deleteCookie(key)
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
