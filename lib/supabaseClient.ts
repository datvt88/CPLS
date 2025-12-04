import { createClient } from '@supabase/supabase-js'

/* -------------------------------------------------
   VALIDATE ENV — Không dùng placeholder nữa
--------------------------------------------------*/
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

/* -------------------------------------------------
   COOKIE STORAGE — chạy an toàn cả server & client
--------------------------------------------------*/
class CookieAuthStorage {
  private storageKey: string

  constructor(key = 'cpls-auth-token') {
    this.storageKey = key
  }

  /* SAFE: luôn return null khi chạy server */
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      return this.getCookie(key) || localStorage.getItem(key)
    } catch {
      return null
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return
    try {
      this.setCookie(key, value, 30)
      localStorage.setItem(key, value)
    } catch {
      /* ignore */
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

  /* COOKIE HELPERS */
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const nameEQ = name + '='
    const ca = document.cookie.split(';')
    for (let c of ca) {
      while (c.charAt(0) === ' ') c = c.substring(1)
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length)
    }
    return null
  }

  private setCookie(name: string, value: string, days: number): void {
    if (typeof document === 'undefined') return
    const date = new Date()
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
    const expires = `; expires=${date.toUTCString()}`
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${name}=${value}${expires}; path=/${secure}; SameSite=Lax`
  }

  private deleteCookie(name: string) {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=; Max-Age=-999999; path=/`
  }
}

const cookieStorage = new CookieAuthStorage()

/* -------------------------------------------------
    CREATE SUPABASE CLIENT — phiên bản chính xác nhất
--------------------------------------------------*/
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',

    // Storage cho client
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
