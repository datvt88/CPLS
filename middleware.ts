import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Next.js Middleware for Route Protection with Custom Claims (JWT)
 * 
 * This middleware handles:
 * 1. Authentication checks for protected routes using Supabase Auth
 * 2. Role-based access control using JWT custom claims
 * 3. Redirecting unauthenticated users to login
 * 4. Handling auth callback routes
 * 5. Refreshing session tokens
 * 
 * Custom Claims in JWT:
 * - role: 'user' | 'mod' | 'admin'
 * - membership: 'free' | 'premium'
 * - is_premium: boolean
 */

/**
 * Extract custom claims from JWT session
 */
interface CustomClaims {
  role?: 'user' | 'mod' | 'admin'
  membership?: 'free' | 'premium'
  is_premium?: boolean
}

function getCustomClaims(session: any): CustomClaims {
  if (!session?.user) return {}
  
  // Claims can be in app_metadata or directly in the token
  const appMetadata = session.user.app_metadata || {}
  
  return {
    role: appMetadata.role || session.user.role || 'user',
    membership: appMetadata.membership || 'free',
    is_premium: appMetadata.is_premium || false
  }
}

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/profile',
  '/chat',
  '/management',
  '/admin',
  '/upgrade',
]

// Routes that require admin or mod role
const ADMIN_ROUTES = [
  '/admin',
  '/management',
]

// Routes that should redirect to dashboard if already authenticated
// Note: '/login' is included for backward compatibility as it redirects to /auth/login,
// but middleware handles it before the redirect page loads
const AUTH_ROUTES = [
  '/auth/login',
]

// Public routes that don't need any check
const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/auth/callback',
  '/api',
  '/signals',
  '/stocks',
  '/market',
  '/dashboard',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  // Create response that we'll modify with session
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client for server
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if needed (this also validates the session)
  const { data: { session } } = await supabase.auth.getSession()

  // Helper to check route matching with proper boundary detection
  const matchesRoute = (routes: string[]) => {
    return routes.some(route => {
      if (pathname === route) return true
      // Ensure route boundary by checking for '/' after the route
      if (pathname.startsWith(route) && (pathname[route.length] === '/' || pathname[route.length] === undefined)) {
        return true
      }
      return false
    })
  }

  // Check if current route is protected
  const isProtectedRoute = matchesRoute(PROTECTED_ROUTES)

  // Check if current route requires admin/mod role
  const isAdminRoute = matchesRoute(ADMIN_ROUTES)

  // Check if current route is an auth route (login/signup)
  const isAuthRoute = matchesRoute(AUTH_ROUTES)

  // Check if current route is public
  const isPublicRoute = matchesRoute(PUBLIC_ROUTES)

  // Handle protected routes - redirect to login if not authenticated
  if (isProtectedRoute && !session) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Handle admin routes - check role from JWT custom claims
  if (isAdminRoute && session) {
    const claims = getCustomClaims(session)
    const hasAdminAccess = claims.role === 'admin' || claims.role === 'mod'
    
    if (!hasAdminAccess) {
      console.log(`[Middleware] Access denied to ${pathname}: user role is ${claims.role}`)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Handle auth routes - redirect to dashboard if already authenticated
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
