import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Nếu có param "next" thì sau này redirect về đó, mặc định là /dashboard
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // 1. Lấy cookie store (Next.js 16 bắt buộc await)
    const cookieStore = await cookies()

    // 2. Tạo Supabase Client (Phiên bản Server)
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
              // Bỏ qua lỗi nếu gọi ở nơi không được phép set cookie (ít khi xảy ra ở Route Handler)
            }
          },
        },
      }
    )

    // 3. Trao đổi Code lấy Session (QUAN TRỌNG NHẤT)
    // Server sẽ tự động đọc cookie "code verifier" từ header request gửi lên
    // nên sẽ KHÔNG BAO GIỜ bị lỗi "verifier empty" như Client Side.
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 4. Login thành công -> Redirect người dùng
      // Xử lý forward host nếu deploy trên Vercel/Docker để tránh lỗi sai domain
      const forwardedHost = request.headers.get('x-forwarded-host') 
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    } else {
      console.error('Auth Error:', error)
      // Nếu lỗi trao đổi code, quay về trang login báo lỗi
      return NextResponse.redirect(`${origin}/auth/login?error=auth_code_error`)
    }
  }

  // Không có code -> Lỗi
  return NextResponse.redirect(`${origin}/auth/login?error=no_code`)
}
