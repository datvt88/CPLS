// VNDirect API utilities for consistent error handling and data fetching
// Following Clean Architecture principles - Infrastructure layer

import { NextResponse } from 'next/server'
import type { NextFetchRequestInit } from './fetch-types'

// ============================================================================
// VNDirect API Configuration
// ============================================================================

const VNDIRECT_API_BASE = 'https://api-finfo.vndirect.com.vn'

/**
 * Build VNDirect API URL
 */
export function buildVNDirectUrl(endpoint: string, params?: Record<string, string>): string {
  const url = new URL(`${VNDIRECT_API_BASE}${endpoint}`)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }
  
  return url.toString()
}

// ============================================================================
// Fetch Utilities
// ============================================================================

/**
 * Fetch data from VNDirect API with error handling
 * @param url - Full VNDirect API URL
 * @param options - Fetch options
 * @returns Promise with parsed JSON data
 */
export async function fetchVNDirect<T>(
  url: string,
  options?: NextFetchRequestInit
): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
        ...options?.headers,
      },
      ...options,
    } as RequestInit) // Type assertion needed for Next.js extended fetch options

    if (!response.ok) {
      throw new Error(`VNDirect API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching from VNDirect: ${url}`, error)
    throw error
  }
}

/**
 * Fetch VNDirect data with fallback to mock data
 * Useful for development and when API is unavailable
 */
export async function fetchVNDirectWithFallback<T>(
  url: string,
  fallbackData: T,
  options?: NextFetchRequestInit
): Promise<T> {
  try {
    return await fetchVNDirect<T>(url, options)
  } catch (error) {
    console.error('VNDirect API failed, using fallback data:', error)
    return fallbackData
  }
}

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Build a standardized error response for VNDirect API failures
 */
export function buildVNDirectErrorResponse(
  error: string | Error,
  fallbackData?: any
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : error
  
  console.error('VNDirect API error:', errorMessage)
  
  // If fallback data provided, return it instead of error
  if (fallbackData) {
    return NextResponse.json(fallbackData)
  }
  
  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
    },
    { status: 500 }
  )
}
