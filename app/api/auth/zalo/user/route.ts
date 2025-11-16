import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route: Get Zalo user information
 * Takes an access token and returns user profile data from Zalo
 *
 * Available fields from Zalo Graph API v2.0:
 * - id: User's unique Zalo ID
 * - name: User's full name
 * - birthday: User's date of birth (DD/MM/YYYY)
 * - gender: User's gender (male/female)
 * - picture: User's profile picture (nested object with data.url)
 *
 * Note: Zalo does NOT provide phone_number through the Graph API
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
    // Request all available fields: id, name, birthday, gender, picture
    // Zalo API v2.0 requires access_token in query parameter (NOT header)
    const userResponse = await fetch(
      `https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture&access_token=${access_token}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    // Get response text for better debugging
    const responseText = await userResponse.text()
    console.log('Zalo user API response status:', userResponse.status)
    console.log('Zalo user API response:', responseText)

    if (!userResponse.ok) {
      console.error('Failed to fetch Zalo user info. Status:', userResponse.status)
      console.error('Response:', responseText)
      return NextResponse.json(
        {
          error: 'Failed to fetch user information',
          details: responseText,
          status: userResponse.status
        },
        { status: 400 }
      )
    }

    // Parse JSON response
    let userData
    try {
      userData = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse Zalo user response:', responseText)
      return NextResponse.json(
        { error: 'Invalid response from Zalo API' },
        { status: 500 }
      )
    }

    // Check for errors in response (Zalo returns 200 with error field)
    if (userData.error) {
      console.error('Zalo API error:', userData)
      return NextResponse.json(
        {
          error: userData.error.message || 'Failed to get user info',
          error_code: userData.error.code,
          details: userData
        },
        { status: 400 }
      )
    }

    // Return all available user data from Zalo
    return NextResponse.json({
      id: userData.id,
      name: userData.name,
      birthday: userData.birthday,  // Format: DD/MM/YYYY
      gender: userData.gender,      // Values: "male" or "female"
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
