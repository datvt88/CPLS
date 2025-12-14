import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Server-side OAuth callback handler
 * 
 * This route handler processes the OAuth callback from providers (Google, etc.)
 * and exchanges the authorization code for a session using PKCE flow.
 * 
 * The server-side handling is necessary to properly process the PKCE code verifier
 * and avoid the "both auth code and code verifier should be non-empty" error.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  
  // Get the authorization code from the URL
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  // Check for OAuth error in URL
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  
  if (error) {
    console.error('[Auth Callback] OAuth error:', error, errorDescription)
    // Redirect to login with error
    const loginUrl = new URL('/auth/login', origin)
    loginUrl.searchParams.set('error', errorDescription || error)
    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    // Create a response object that we can modify with cookies
    const response = NextResponse.redirect(new URL(next, origin))
    
    // Create Supabase server client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    try {
      // Exchange the authorization code for a session
      // This handles the PKCE flow server-side, avoiding client-side race conditions
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('[Auth Callback] Code exchange error:', exchangeError.message)
        // Redirect to login with error
        const loginUrl = new URL('/auth/login', origin)
        loginUrl.searchParams.set('error', exchangeError.message)
        return NextResponse.redirect(loginUrl)
      }
      
      // Success - redirect to the next page (default: dashboard)
      return response
    } catch (err) {
      console.error('[Auth Callback] Unexpected error during code exchange:', err)
      const loginUrl = new URL('/auth/login', origin)
      loginUrl.searchParams.set('error', 'Unexpected authentication error')
      return NextResponse.redirect(loginUrl)
    }
  }

  // No code present - this is an unexpected state
  // Redirect to dashboard if user might already be authenticated
  // or to login if not
  console.warn('[Auth Callback] No authorization code present in callback URL')
  return NextResponse.redirect(new URL('/dashboard', origin))
}
