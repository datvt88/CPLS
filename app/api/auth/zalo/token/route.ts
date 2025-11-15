import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route: Exchange Zalo authorization code for access token
 * IMPORTANT: This runs on the server, keeping APP_SECRET secure
 */
export async function POST(request: NextRequest) {
  try {
    const { code, code_verifier } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    if (!code_verifier) {
      return NextResponse.json(
        { error: 'Code verifier is required (PKCE)' },
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
    // Zalo API v4 - Use secret_key in header (confirmed working from PHP reference)
    // PKCE is REQUIRED by Zalo OAuth v4
    const tokenResponse = await fetch('https://oauth.zaloapp.com/v4/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': appSecret,  // Fixed: secret_key in header, not app_secret in body
      },
      body: new URLSearchParams({
        code: code,
        app_id: appId,
        grant_type: 'authorization_code',
        code_verifier: code_verifier,  // PKCE verifier - REQUIRED by Zalo OAuth v4
      }),
    })

    // Get response text first for better error handling
    const responseText = await tokenResponse.text()
    console.log('Zalo token response:', responseText)

    if (!tokenResponse.ok) {
      console.error('Zalo token exchange failed. Status:', tokenResponse.status)
      console.error('Response:', responseText)
      return NextResponse.json(
        {
          error: 'Failed to exchange authorization code',
          details: responseText,
          status: tokenResponse.status
        },
        { status: 400 }
      )
    }

    // Parse response
    let tokenData
    try {
      tokenData = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse Zalo response:', responseText)
      return NextResponse.json(
        { error: 'Invalid response from Zalo API' },
        { status: 500 }
      )
    }

    // Check for errors in response (Zalo returns 200 with error field)
    if (tokenData.error || tokenData.error_code) {
      console.error('Zalo API error:', {
        error: tokenData.error,
        error_code: tokenData.error_code,
        error_message: tokenData.error_message,
        error_description: tokenData.error_description,
      })
      return NextResponse.json(
        {
          error: tokenData.error_message || tokenData.error_description || 'Token exchange failed',
          error_code: tokenData.error_code || tokenData.error,
          details: tokenData
        },
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
