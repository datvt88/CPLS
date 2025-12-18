/**
 * Authentication Types
 * 
 * Centralized type definitions for authentication, authorization and session management.
 * This file consolidates all auth-related types for better maintainability.
 */

import type { User, Session, AuthError } from '@supabase/supabase-js'

// ============================================================================
// User Roles & Permissions
// ============================================================================

/**
 * User role in the system
 */
export type UserRole = 'user' | 'mod' | 'admin'

/**
 * Membership tier for subscription access
 * - free: Giới hạn 3 lần Deep Analysis/ngày
 * - premium: Giới hạn 20 lần Deep Analysis/ngày
 * - diamond: Không giới hạn Deep Analysis và truy cập tất cả trang
 */
export type MembershipTier = 'free' | 'premium' | 'diamond'

/**
 * Custom claims from JWT (injected by custom_access_token_hook)
 */
export interface CustomClaims {
  role?: UserRole
  membership?: MembershipTier
  is_premium?: boolean // true for premium or diamond
  is_diamond?: boolean // true only for diamond tier
}

// ============================================================================
// Auth Credentials
// ============================================================================

export interface EmailCredentials {
  email: string
  password: string
}

export interface PhoneCredentials {
  phoneNumber: string
  password: string
}

export interface OAuthOptions {
  redirectTo?: string
}

// ============================================================================
// Auth Results
// ============================================================================

export interface AuthResult<T = void> {
  data: T | null
  error: AuthError | { message: string } | null
}

export interface SessionResult {
  session: Session | null
  error: AuthError | { message: string } | null
}

export interface UserResult {
  user: User | null
  error: AuthError | { message: string } | null
}

// ============================================================================
// Permission Data
// ============================================================================

import type { Feature } from '@/lib/permissions'

export interface PermissionData {
  isAuthenticated: boolean
  membership: MembershipTier
  isPremium: boolean // true for premium or diamond
  isDiamond: boolean // true only for diamond
  features: Feature[]
  role: UserRole
  userId: string | null
}

// ============================================================================
// Auth Context Values
// ============================================================================

export interface AuthContextValue {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithPhone: (phoneNumber: string, password: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  refreshSession: () => Promise<void>
}

// ============================================================================
// Session Info
// ============================================================================

export interface SessionInfo {
  id: string
  device_name: string
  device_type: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
  ip_address: string
  last_activity: string
  created_at: string
  is_current: boolean
}

export interface DeviceInfo {
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  browser: string
  os: string
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { User, Session, AuthError }
