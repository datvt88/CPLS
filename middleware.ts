import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/stocks',
  '/market',
  '/signals',
  '/chat',
  '/profile',
  '/management',
  '/admin',
]

// Define admin-only routes
const adminRoutes = [
  '/management',
  '/admin',
]

// Define public routes (no authentication needed)
const publicRoutes = [
  '/',
  '/login',
  '/pricing',
  '/auth/callback',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Allow API routes to handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
  ) {
    return NextResponse.next()
  }

  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    // Get auth token from cookie
    const authToken = request.cookies.get('cpls-auth-token')

    // If no token, redirect to login
    if (!authToken) {
      console.log('🔒 No auth token, redirecting to login:', pathname)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }

    // For admin routes, we'll let the AdminRoute component handle detailed auth check
    // Here we just ensure there's a session
    const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
    if (isAdminRoute) {
      // Token exists, let AdminRoute component do the role check
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
