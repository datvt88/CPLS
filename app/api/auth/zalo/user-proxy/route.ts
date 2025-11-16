import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy endpoint for Zalo Graph API
 *
 * This endpoint forwards requests to a Vietnam-based proxy server
 * to bypass Zalo's IP geolocation restriction.
 *
 * IMPORTANT: You need to set up a proxy server in Vietnam
 * and update ZALO_PROXY_URL environment variable.
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

    // Option 1: Use your own Vietnam-based proxy server
    const proxyUrl = process.env.ZALO_PROXY_URL

    if (proxyUrl) {
      console.log('Using Vietnam proxy server:', proxyUrl)

      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token }),
      })

      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    }

    // Option 2: Direct call (will fail if IP not in Vietnam)
    console.log('No proxy configured, calling Zalo API directly...')
    console.log('⚠️ This will fail if server IP is not in Vietnam')

    const userResponse = await fetch(
      `https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture&access_token=${access_token}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    )

    const responseText = await userResponse.text()
    console.log('Zalo API response:', responseText)

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch user info', details: responseText },
        { status: userResponse.status }
      )
    }

    const userData = JSON.parse(responseText)

    if (userData.error) {
      return NextResponse.json(
        {
          error: userData.message || 'Zalo API error',
          error_code: userData.error,
          details: userData,
          suggestion: 'Deploy server to Vietnam or Singapore region, or use a Vietnam-based proxy'
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      id: userData.id,
      name: userData.name,
      birthday: userData.birthday,
      gender: userData.gender,
      picture: userData.picture?.data?.url,
    })

  } catch (error) {
    console.error('Error in Zalo proxy:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
