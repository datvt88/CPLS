import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route: Get Zalo user information
 * Takes an access token and returns user profile data from Zalo
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token } = await request.json()

    if (!access_token) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      )
    }

    // Fetch user info from Zalo Graph API
    // Send access_token in header (confirmed working from PHP reference)
    const userResponse = await fetch(
      `https://graph.zalo.me/v2.0/me?fields=id,name,picture`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access_token': access_token,  // Fixed: access_token in header
        },
      }
    )

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('Failed to fetch Zalo user info:', errorText)
      return NextResponse.json(
        { error: 'Failed to fetch user information' },
        { status: 400 }
      )
    }

    const userData = await userResponse.json()

    // Check for errors in response
    if (userData.error) {
      console.error('Zalo API error:', userData)
      return NextResponse.json(
        { error: userData.error.message || 'Failed to get user info' },
        { status: 400 }
      )
    }

    // Return user data
    return NextResponse.json({
      id: userData.id,
      name: userData.name,
      picture: userData.picture?.data?.url,
    })
  } catch (error) {
    console.error('Error fetching Zalo user info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
