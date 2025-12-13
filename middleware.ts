import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Next.js Middleware for Route Protection
 * 
 * This middleware handles:
 * 1. Authentication checks for protected routes
 * 2. Redirecting unauthenticated users to login
 * 3. Handling auth callback routes
 * 4. Refreshing session tokens
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/signals',
  '/stocks',
  '/co-phieu', // Vietnamese alias for /stocks
  '/chat',
  '/management',
  '/admin',
  '/upgrade',
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
  '/market',
  '/auth/callback',
  '/api',
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

  // Create Supabase client for server with matching cookie configuration
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'cpls-auth-token', // Must match client storageKey in lib/supabaseClient.ts
      },
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

  // Validate session by getting user from Supabase server
  // Note: getUser() validates with the server, unlike getSession() which only reads from storage
  // First refresh session if needed
  const { data: { session } } = await supabase.auth.getSession()
  
  // If we have a session, validate it by getting the user
  let isAuthenticated = false
  if (session) {
    const { data: { user }, error } = await supabase.auth.getUser()
    isAuthenticated = !!user && !error
  }

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

  // Check if current route is an auth route (login/signup)
  const isAuthRoute = matchesRoute(AUTH_ROUTES)

  // Check if current route is public
  const isPublicRoute = matchesRoute(PUBLIC_ROUTES)

  // Handle protected routes - redirect to login if not authenticated
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Handle auth routes - redirect to dashboard if already authenticated
  if (isAuthRoute && isAuthenticated) {
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
