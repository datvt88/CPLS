/**
 * Authentication Constants
 * 
 * Centralized configuration for authentication, authorization and route protection.
 * This file consolidates all auth-related constants for better maintainability.
 */

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * Key for storing auth token in localStorage/cookies
 * Must match between client-side supabaseClient.ts and middleware.ts
 */
export const AUTH_STORAGE_KEY = 'cpls-auth-token'

/**
 * Key for storing device fingerprint
 */
export const DEVICE_FINGERPRINT_KEY = 'cpls_device_fingerprint'

/**
 * Key for storing device ID
 */
export const DEVICE_ID_KEY = 'cpls-device-id'

// ============================================================================
// Timeouts & Delays
// ============================================================================

/**
 * Default timeout for auth operations (ms)
 */
export const AUTH_TIMEOUT = 10000

/**
 * Timeout for OAuth operations (ms)
 */
export const OAUTH_TIMEOUT = 15000

/**
 * Session check timeout on login page (ms)
 */
export const SESSION_CHECK_TIMEOUT = 3000

/**
 * Max wait time for session in OAuth callback (ms)
 */
export const MAX_SESSION_WAIT_TIME = 15000

/**
 * Delay for Supabase to process URL in callback (ms)
 */
export const SUPABASE_PROCESSING_DELAY = 500

/**
 * Delay before redirecting on error (ms)
 */
export const ERROR_REDIRECT_DELAY = 2000

/**
 * Delay before redirecting on success (ms)
 */
export const SUCCESS_REDIRECT_DELAY = 300

/**
 * Cookie expiry in days
 */
export const COOKIE_EXPIRY_DAYS = 30

/**
 * Session inactivity timeout (30 days in ms)
 */
export const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000

// ============================================================================
// ProtectedRoute Configuration
// ============================================================================

/**
 * Grace period to wait for auth to stabilize after initial load (ms)
 */
export const AUTH_STABILIZATION_DELAY = 800

/**
 * Maximum time to wait for verification before forcing completion (ms)
 */
export const MAX_VERIFICATION_TIMEOUT = 6000

/**
 * Time to wait for state to propagate after refresh (ms)
 */
export const STATE_PROPAGATION_DELAY = 150

/**
 * Number of retry attempts for verification
 */
export const MAX_RETRY_ATTEMPTS = 2

// ============================================================================
// PermissionsContext Configuration
// ============================================================================

/**
 * Timeout for initialization (ms)
 */
export const PERMISSIONS_INIT_TIMEOUT = 8000

/**
 * Session cache TTL (ms)
 */
export const SESSION_CACHE_TTL = 5000

/**
 * Deduping interval for SWR (ms)
 */
export const PERMISSIONS_DEDUPE_INTERVAL = 60000

// ============================================================================
// Route Configuration
// ============================================================================

/**
 * Routes that require authentication
 */
export const PROTECTED_ROUTES = [
  '/profile',
  '/chat',
  '/management',
  '/admin',
  '/upgrade',
] as const

/**
 * Routes that require Admin or Mod role
 */
export const ADMIN_ROUTES = [
  '/admin',
  '/management',
] as const

/**
 * Routes that require Premium membership
 */
export const PREMIUM_ROUTES = [
  '/premium-content',
] as const

/**
 * Authentication routes (redirect to dashboard if already logged in)
 */
export const AUTH_ROUTES = [
  '/auth/login',
  '/login',
  '/register',
] as const

/**
 * Public routes (no auth check)
 */
export const PUBLIC_ROUTES = [
  '/',
  '/pricing',
  '/auth/callback',
  '/api',
  '/market',
] as const

// ============================================================================
// Device Limits
// ============================================================================

/**
 * Maximum number of devices per user
 */
export const MAX_DEVICES = 3

// ============================================================================
// Session Manager Configuration
// ============================================================================

/**
 * Visibility change debounce time (ms)
 */
export const VISIBILITY_DEBOUNCE = 2000

/**
 * Session check debounce time (ms)
 */
export const SESSION_CHECK_DEBOUNCE = 5000

/**
 * Sync interval for auth storage (ms)
 */
export const AUTH_SYNC_INTERVAL = 10000
