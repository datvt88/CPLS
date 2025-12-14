/**
 * Authentication Helpers
 * 
 * Utility functions for authentication operations.
 * These helpers are used across auth-related components and services.
 */

import type { CustomClaims, UserRole } from '@/types/auth'
import type { User, Session } from '@supabase/supabase-js'

// ============================================================================
// Claims Extraction
// ============================================================================

/**
 * Extract custom claims from user object
 * Claims are injected by the custom_access_token_hook in Supabase
 * 
 * @param user - Supabase user object
 * @returns Custom claims (role, membership, is_premium)
 */
export function getClaimsFromUser(user: User | null): CustomClaims {
  if (!user) return {}
  
  // Claims can be in app_metadata (from custom_access_token_hook)
  // or in user_metadata (fallback for compatibility)
  const appMetadata = user.app_metadata || {}
  const userMetadata = user.user_metadata || {}
  
  return {
    role: (appMetadata.role ?? userMetadata.role) as UserRole | undefined,
    membership: (appMetadata.membership ?? userMetadata.membership) as 'free' | 'premium' | undefined,
    is_premium: (appMetadata.is_premium ?? userMetadata.is_premium) as boolean | undefined
  }
}

/**
 * Extract custom claims from session object
 * 
 * @param session - Supabase session object
 * @returns Custom claims (role, membership, is_premium)
 */
export function getClaimsFromSession(session: Session | null): CustomClaims {
  return getClaimsFromUser(session?.user ?? null)
}

// ============================================================================
// Permission Checks
// ============================================================================

/**
 * Check if user has admin access (admin or mod role)
 */
export function hasAdminAccess(claims: CustomClaims): boolean {
  return claims.role === 'admin' || claims.role === 'mod'
}

/**
 * Check if user has premium access
 */
export function hasPremiumAccess(claims: CustomClaims): boolean {
  return claims.is_premium === true || claims.membership === 'premium'
}

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Get the OAuth callback URL
 * Always returns /auth/callback for consistent handling
 */
export function getCallbackUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }
  return ''
}

/**
 * Get redirect URL after login
 * Checks for 'next' parameter or defaults to dashboard
 */
export function getRedirectUrl(searchParams?: URLSearchParams): string {
  const next = searchParams?.get('next')
  return next || '/dashboard'
}

// ============================================================================
// Timeout Wrapper
// ============================================================================

/**
 * Wraps a promise with a timeout
 * 
 * @param promise - Promise to wrap
 * @param ms - Timeout in milliseconds
 * @returns Promise that rejects if timeout is exceeded
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), ms)
    )
  ])
}

// ============================================================================
// Error Message Mapping
// ============================================================================

/**
 * Map of known OAuth error codes to user-friendly Vietnamese messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  'access_denied': 'Bạn đã từ chối quyền truy cập. Vui lòng thử lại.',
  'invalid_request': 'Yêu cầu không hợp lệ. Vui lòng thử đăng nhập lại.',
  'unauthorized_client': 'Ứng dụng chưa được ủy quyền. Vui lòng liên hệ hỗ trợ.',
  'unsupported_response_type': 'Loại phản hồi không được hỗ trợ.',
  'server_error': 'Lỗi máy chủ. Vui lòng thử lại sau.',
  'temporarily_unavailable': 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
  'invalid_grant': 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
  'serverautherror': 'Lỗi xác thực từ máy chủ. Vui lòng thử đăng nhập lại.',
  'nocodeprovided': 'Không tìm thấy mã xác thực. Vui lòng thử đăng nhập lại.',
  'nosession': 'Không thể thiết lập phiên đăng nhập. Vui lòng thử lại.',
  'unexpectederror': 'Đã xảy ra lỗi không mong đợi. Vui lòng thử lại.',
  'code verifier': 'Lỗi xác thực PKCE. Vui lòng xóa cache trình duyệt và thử lại.',
  'pkce': 'Lỗi xác thực bảo mật. Vui lòng thử đăng nhập lại.',
  'both auth code and code verifier': 'Phiên xác thực đã hết hạn. Vui lòng thử đăng nhập lại.',
  'exchange_failed': 'Không thể hoàn tất đăng nhập. Vui lòng thử lại.',
  'timeout': 'Quá thời gian chờ xác thực. Vui lòng thử lại.',
}

/**
 * Sanitize and map OAuth error messages to user-friendly Vietnamese messages
 * This prevents XSS attacks and improves user experience
 * 
 * @param rawError - Raw error message from OAuth provider
 * @returns Sanitized user-friendly error message
 */
export function sanitizeErrorMessage(rawError: string | null): string | null {
  if (!rawError) return null
  
  const lowerError = rawError.toLowerCase()
  
  // Check if the error matches a known pattern
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (lowerError.includes(key.toLowerCase())) {
      return value
    }
  }
  
  // For unknown errors, only allow safe characters (whitelist approach)
  const allowedPattern = /^[\p{L}\p{N}\s.,!?;:'-]+$/u
  if (allowedPattern.test(rawError)) {
    return rawError.length > 200 ? rawError.substring(0, 200) + '...' : rawError
  }
  
  // Return generic message for suspicious content
  return 'Đã xảy ra lỗi xác thực. Vui lòng thử đăng nhập lại.'
}

// ============================================================================
// Route Matching
// ============================================================================

/**
 * Check if pathname matches any of the given routes
 * Handles both exact matches and prefix matches
 * 
 * @param pathname - Current pathname
 * @param routes - Array of routes to check
 * @returns True if pathname matches any route
 */
export function matchesRoute(pathname: string, routes: readonly string[]): boolean {
  return routes.some(route => {
    if (pathname === route) return true
    if (pathname.startsWith(route) && 
        (pathname[route.length] === '/' || pathname[route.length] === undefined)) {
      return true
    }
    return false
  })
}
