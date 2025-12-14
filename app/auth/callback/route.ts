import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorParam = searchParams.get('error')
  const errorDesc = searchParams.get('error_description')

  // 1. Check lỗi ngay từ Google trả về
  if (errorParam) {
    console.error('🔴 Lỗi từ Google:', errorParam, errorDesc)
    return NextResponse.redirect(`${origin}/auth/login?error=${errorParam}&error_description=${errorDesc}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )
    
    // 2. Log quá trình trao đổi code
    console.log('🟡 Đang trao đổi code lấy session:', code)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('🟢 Đăng nhập thành công! Redirect về:', next)
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('🔴 Lỗi Supabase Exchange:', error.message) // <--- XEM LỖI Ở ĐÂY
      return NextResponse.redirect(`${origin}/auth/login?error=ServerAuthError&error_description=${encodeURIComponent(error.message)}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=NoCode`)
}
