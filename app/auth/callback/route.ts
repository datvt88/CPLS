import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  
  // Lấy thông tin origin để redirect về đúng domain (tránh lỗi localhost vs 127.0.0.1)
  const origin = requestUrl.origin

  // 1. Kiểm tra nếu Google trả về lỗi ngay lập tức
  const errorParam = requestUrl.searchParams.get('error')
  const errorDesc = requestUrl.searchParams.get('error_description')
  if (errorParam) {
    console.error('[Auth Callback] Lỗi từ Provider:', errorParam, errorDesc)
    return NextResponse.redirect(`${origin}/auth/login?error=${errorParam}&error_description=${errorDesc}`)
  }

  if (code) {
    // 2. Chuẩn bị Cookie Store (Next.js 16 bắt buộc await)
    const cookieStore = await cookies()

    // 3. Khởi tạo Supabase Client (Server-side)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Bỏ qua lỗi nếu set cookie thất bại (thường không xảy ra ở Route Handler)
            }
          },
        },
      }
    )

    // 4. Trao đổi Code lấy Session (Bước quan trọng nhất)
    // Server sẽ tự động đọc cookie 'sb-xxxx-auth-token-code-verifier'
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 5. Thành công -> Chuyển hướng về trang đích (Dashboard)
      
      // Kiểm tra forwarded host để hỗ trợ deploy Vercel/Docker tốt hơn
      const forwardedHost = request.headers.get('x-forwarded-host') 
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        // Môi trường Local: Redirect về origin gốc
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        // Môi trường Prod: Redirect về đúng domain thật
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      // 6. Thất bại -> Log lỗi ra Terminal để debug
      console.error('[Auth Callback] Lỗi Exchange Code:', error.message)
      
      // Trả về trang Login kèm thông báo lỗi chi tiết
      return NextResponse.redirect(`${origin}/auth/login?error=ServerAuthError&error_description=${encodeURIComponent(error.message)}`)
    }
  }

  // Trường hợp không có Code gửi lên
  console.error('[Auth Callback] Không tìm thấy Code trong URL')
  return NextResponse.redirect(`${origin}/auth/login?error=NoCodeProvided`)
}
