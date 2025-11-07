import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route: Exchange Zalo authorization code for access token
 * IMPORTANT: This runs on the server, keeping APP_SECRET secure
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID
    const appSecret = process.env.ZALO_APP_SECRET

    if (!appId || !appSecret) {
      console.error('Zalo credentials not configured')
      return NextResponse.json(
        { error: 'Zalo OAuth not properly configured' },
        { status: 500 }
      )
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': appSecret,
      },
      body: new URLSearchParams({
        app_id: appId,
        code: code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Zalo token exchange failed:', errorText)
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 400 }
      )
    }

    const tokenData = await tokenResponse.json()

    // Check for errors in response
    if (tokenData.error) {
      console.error('Zalo API error:', tokenData)
      return NextResponse.json(
        { error: tokenData.error_description || 'Token exchange failed' },
        { status: 400 }
      )
    }

    // Return access token to client
    // Note: In production, you might want to store this server-side
    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
    })
  } catch (error) {
    console.error('Error in Zalo token exchange:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
