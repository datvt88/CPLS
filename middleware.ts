import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { CustomClaims, UserRole } from '@/types/auth'
import { 
  AUTH_STORAGE_KEY,
  PROTECTED_ROUTES,
  ADMIN_ROUTES,
  PREMIUM_ROUTES,
  AUTH_ROUTES,
} from '@/lib/auth/constants'
import type { User } from '@supabase/supabase-js'

/**
 * Next.js Middleware for Route Protection
 * 
 * Handles:
 * - Authentication: Redirects unauthenticated users to login
 * - Authorization: Checks admin/mod roles for admin routes
 * - Premium access: Checks premium membership for premium routes
 * - Auth routes: Redirects authenticated users away from login page
 */

/**
 * Extract custom claims from user object
 * Claims are injected by the custom_access_token_hook in Supabase
 */
function getCustomClaims(user: User | null): CustomClaims {
  if (!user) return {}
  
  const appMetadata = user.app_metadata || {}
  const userMetadata = user.user_metadata || {}
  
  return {
    role: (appMetadata.role ?? userMetadata.role) as UserRole | undefined,
    membership: (appMetadata.membership ?? userMetadata.membership) as 'free' | 'premium' | undefined,
    is_premium: (appMetadata.is_premium ?? userMetadata.is_premium) as boolean | undefined
  }
}

/**
 * Check if pathname matches any of the given routes
 */
function matchesRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some(route => {
    if (pathname === route) return true
    if (pathname.startsWith(route) && 
        (pathname[route.length] === '/' || pathname[route.length] === undefined)) {
      return true
    }
    return false
  })
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files and API routes
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
  
  // Create Supabase Client with SSR support
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
      cookieOptions: {
        name: AUTH_STORAGE_KEY,
      },
    }
  )

  // Use getUser() instead of getSession() for better security
  const { data: { user } } = await supabase.auth.getUser()

  // Check route types
  const isProtectedRoute = matchesRoute(pathname, PROTECTED_ROUTES)
  const isAdminRoute = matchesRoute(pathname, ADMIN_ROUTES)
  const isPremiumRoute = matchesRoute(pathname, PREMIUM_ROUTES)
  const isAuthRoute = matchesRoute(pathname, AUTH_ROUTES)

  // --- 1. AUTH ROUTES (Login/Register) ---
  // Redirect authenticated users to dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // --- 2. PROTECTED ROUTES ---
  // Redirect unauthenticated users to login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // --- 3. AUTHORIZATION (RBAC & Premium) ---
  if (user) {
    const claims = getCustomClaims(user)
    const role = claims.role || 'user'
    const plan = claims.membership || 'free'

    // A. Admin routes - require admin or mod role
    if (isAdminRoute) {
      const hasAccess = role === 'admin' || role === 'mod'
      
      if (!hasAccess) {
        console.log(`[Middleware] Access denied to ${pathname}: user role is ${role}`)
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // B. Premium routes - require premium membership or admin/mod role
    if (isPremiumRoute) {
      const hasAccess = plan === 'premium' || role === 'admin' || role === 'mod'
      
      if (!hasAccess) {
        console.log(`[Middleware] Access denied to ${pathname}: plan is ${plan}`)
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
