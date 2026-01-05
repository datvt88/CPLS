// Centralized API utilities for consistent error handling and response formatting
// Following Clean Architecture principles - Infrastructure layer

import { NextResponse } from 'next/server'
import type { NextFetchRequestInit } from './fetch-types'

// ============================================================================
// Error Response Types
// ============================================================================

export interface ApiErrorResponse {
  success: false
  error: string
  statusCode?: number
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.SIGNAL_API_URL || process.env.NEXT_PUBLIC_API_URL
const REVALIDATE_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REVALIDATE_INTERVAL || '60', 10)

/**
 * Get the external API base URL
 * @throws Error if API URL is not configured
 */
export function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error('API URL not configured')
  }
  return API_BASE_URL
}

/**
 * Get revalidation interval for caching
 */
export function getRevalidateInterval(): number {
  return REVALIDATE_INTERVAL
}

// ============================================================================
// Fetch Utilities
// ============================================================================

/**
 * Fetch data from external API with consistent error handling
 * @param endpoint - API endpoint (will be appended to base URL)
 * @param options - Fetch options
 * @returns Promise with API response
 */
export async function fetchExternalApi<T>(
  endpoint: string,
  options?: NextFetchRequestInit
): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${endpoint}`

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      next: { revalidate: REVALIDATE_INTERVAL },
      ...options,
    } as RequestInit) // Type assertion needed for Next.js extended fetch options

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error)
    throw error
  }
}

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Build a standardized error response
 */
export function buildErrorResponse(
  error: string | Error,
  statusCode: number = 500
): NextResponse<ApiErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : error
  
  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      statusCode,
    },
    { status: statusCode }
  )
}

/**
 * Build a standardized success response
 */
export function buildSuccessResponse<T>(
  data: T,
  statusCode: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status: statusCode }
  )
}
