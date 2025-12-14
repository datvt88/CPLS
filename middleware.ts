import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { type User } from '@supabase/supabase-js'

/**
 * Next.js Middleware for Route Protection
 * Đã sửa đổi để tương thích với Supabase Free Plan (Database Trigger)
 */

/**
 * Interface cho Custom Claims
 * Khớp với dữ liệu mà Trigger SQL sync_profile_to_metadata() tạo ra
 */
interface CustomClaims {
  role?: 'user' | 'mod' | 'admin'
  membership?: 'free' | 'premium'
  is_premium?: boolean
}

/**
 * Hàm lấy claims từ app_metadata (được inject bởi custom_access_token_hook)
 * Fallback sang user_metadata nếu không tìm thấy trong app_metadata
 */
function getCustomClaims(user: User | null): CustomClaims {
  if (!user) return {}
  
  // Ưu tiên đọc từ app_metadata (được inject bởi custom_access_token_hook)
  const appMetadata = user.app_metadata || {}
  const userMetadata = user.user_metadata || {}
  
  return {
    role: (appMetadata.role ?? userMetadata.role) as CustomClaims['role'],
    membership: (appMetadata.membership ?? userMetadata.membership) as CustomClaims['membership'],
    is_premium: (appMetadata.is_premium ?? userMetadata.is_premium) as boolean | undefined
  }
}

// 1. Routes bắt buộc phải đăng nhập
const PROTECTED_ROUTES = [
  '/profile',
  '/chat',
  '/management',
  '/admin',
  '/upgrade',
]

// 2. Routes chỉ dành cho Admin/Mod
const ADMIN_ROUTES = [
  '/admin',
  '/management',
]

// 3. Routes chỉ dành cho thành viên Premium (Mới thêm)
const PREMIUM_ROUTES = [
  '/signals',
  '/stocks',
  '/premium-content',
]

// 4. Routes Authentication (Nếu đã login thì đá về dashboard)
const AUTH_ROUTES = [
  '/auth/login',
  '/login',
  '/register',
]

// 5. Routes Public (Không kiểm tra gì cả)
const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/auth/callback',
  '/api',
  '/market',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bỏ qua static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Tạo Supabase Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // QUAN TRỌNG: Dùng getUser() thay vì getSession() để bảo mật hơn
  const { data: { user } } = await supabase.auth.getUser()

  // Helper function để check route logic
  const matchesRoute = (routes: string[]) => {
    return routes.some(route => {
      if (pathname === route) return true
      if (pathname.startsWith(route) && (pathname[route.length] === '/' || pathname[route.length] === undefined)) {
        return true
      }
      return false
    })
  }

  const isProtectedRoute = matchesRoute(PROTECTED_ROUTES)
  const isAdminRoute = matchesRoute(ADMIN_ROUTES)
  const isPremiumRoute = matchesRoute(PREMIUM_ROUTES)
  const isAuthRoute = matchesRoute(AUTH_ROUTES)

  // --- 1. XỬ LÝ AUTH ROUTE (Login/Register) ---
  // Nếu đã login mà cố vào trang login -> Redirect về Dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // --- 2. XỬ LÝ PROTECTED ROUTE (Chưa login) ---
  // Nếu vào trang bảo mật mà chưa login -> Redirect về Login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // --- 3. XỬ LÝ PHÂN QUYỀN (RBAC & Premium) ---
  if (user) {
    // Lấy thông tin quyền hạn từ app_metadata (được inject bởi custom_access_token_hook)
    const claims = getCustomClaims(user)
    const role = claims.role || 'user'
    const plan = claims.membership || 'free'

    // A. Check quyền Admin
    if (isAdminRoute) {
      const hasAdminAccess = role === 'admin' || role === 'mod'
      
      if (!hasAdminAccess) {
        console.log(`[Middleware] Access denied to ${pathname}: user role is ${role}`)
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // B. Check quyền Premium (Thêm mới)
    if (isPremiumRoute) {
      // Logic: Cho phép nếu là Premium HOẶC là Admin/Mod
      const hasPremiumAccess = plan === 'premium' || role === 'admin' || role === 'mod'
      
      if (!hasPremiumAccess) {
        console.log(`[Middleware] Access denied to ${pathname}: plan is ${plan}`)
        // Redirect về trang Pricing để dụ mua gói
        return NextResponse.redirect(new URL('/pricing', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
