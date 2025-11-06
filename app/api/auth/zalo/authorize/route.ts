import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route: Generate Zalo OAuth Authorization URL
 * This is safe to call from client as it only returns the authorization URL
 */
export async function GET(request: NextRequest) {
  try {
    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID

    if (!appId) {
      return NextResponse.json(
        { error: 'Zalo App ID not configured' },
        { status: 500 }
      )
    }

    // Get the origin for redirect URI
    const origin = request.headers.get('origin') || 'http://localhost:3000'
    const redirectUri = `${origin}/auth/callback`

    // Build Zalo OAuth URL
    const authUrl = new URL('https://oauth.zaloapp.com/v4/permission')
    authUrl.searchParams.set('app_id', appId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', generateState()) // CSRF protection

    return NextResponse.json({
      authUrl: authUrl.toString(),
      redirectUri,
    })
  } catch (error) {
    console.error('Error generating Zalo auth URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}

/**
 * Generate random state for CSRF protection
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15)
}
