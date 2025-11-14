/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * Used for secure OAuth 2.0 authorization code flow
 *
 * References:
 * - RFC 7636: https://tools.ietf.org/html/rfc7636
 * - Zalo OAuth v4: https://developers.zalo.me/docs/social-api/tham-khao/user-access-token-v4
 */

/**
 * Generate a random code verifier for PKCE
 *
 * Returns a URL-safe base64-encoded random string (43-128 characters)
 * Used in the authorization request and token exchange
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes (will become 43 chars in base64url)
  const randomBytes = new Uint8Array(32)

  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    window.crypto.getRandomValues(randomBytes)
  } else {
    // Node.js environment
    const crypto = require('crypto')
    crypto.randomFillSync(randomBytes)
  }

  return base64URLEncode(randomBytes)
}

/**
 * Generate code challenge from code verifier using SHA256
 *
 * @param verifier - The code verifier string
 * @returns Base64URL-encoded SHA256 hash of the verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment - use Web Crypto API
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
    return base64URLEncode(new Uint8Array(hashBuffer))
  } else {
    // Node.js environment
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256').update(verifier).digest()
    return base64URLEncode(hash)
  }
}

/**
 * Encode buffer to base64url format (URL-safe)
 *
 * @param buffer - Uint8Array or Buffer to encode
 * @returns Base64URL-encoded string
 */
function base64URLEncode(buffer: Uint8Array | Buffer): string {
  // Convert to base64
  let base64: string

  if (typeof window !== 'undefined') {
    // Browser - convert Uint8Array to base64
    base64 = btoa(String.fromCharCode(...Array.from(buffer)))
  } else {
    // Node.js - Buffer has built-in base64
    base64 = Buffer.from(buffer).toString('base64')
  }

  // Make URL-safe: replace +/= with -_
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Validate code verifier format
 * Must be 43-128 characters, containing only unreserved characters
 *
 * @param verifier - Code verifier to validate
 * @returns True if valid
 */
export function isValidCodeVerifier(verifier: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) {
    return false
  }

  // Check if contains only unreserved characters: [A-Z] [a-z] [0-9] - . _ ~
  const validPattern = /^[A-Za-z0-9\-._~]+$/
  return validPattern.test(verifier)
}

/**
 * Example usage:
 *
 * // Generate PKCE values for authorization
 * const verifier = generateCodeVerifier()
 * const challenge = await generateCodeChallenge(verifier)
 *
 * // Store verifier for later use
 * sessionStorage.setItem('code_verifier', verifier)
 *
 * // Send challenge in authorization URL
 * authUrl.searchParams.set('code_challenge', challenge)
 * authUrl.searchParams.set('code_challenge_method', 'S256')
 *
 * // Later, retrieve verifier for token exchange
 * const storedVerifier = sessionStorage.getItem('code_verifier')
 * // Send storedVerifier in token request
 */
