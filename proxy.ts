import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Define public routes (no authentication needed)
const publicRoutes = [
  '/',
  '/login',
  '/pricing',
  '/auth/callback',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow API routes to handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|webp|gif)$/)
  ) {
    return NextResponse.next()
  }

  // For all other routes, let ProtectedRoute/AdminRoute components handle auth
  // Middleware only does basic cookie presence check (no redirect)
  const authToken = request.cookies.get('cpls-auth-token')

  if (!authToken) {
    console.log('⚠️ Proxy: No auth cookie for:', pathname)
    // Don't redirect here - let components handle it
    // This prevents middleware/component conflicts
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
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
