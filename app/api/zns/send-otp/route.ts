import { NextRequest, NextResponse } from 'next/server'

/**
 * ZNS API: Send OTP via Zalo Notification Service
 * Sends OTP to user's phone number for registration verification
 */
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate phone number format (Vietnam)
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    const znsAccessToken = process.env.ZNS_ACCESS_TOKEN
    const znsTemplateId = process.env.ZNS_TEMPLATE_ID

    if (!znsAccessToken || !znsTemplateId) {
      console.error('ZNS credentials not configured')
      return NextResponse.json(
        { error: 'ZNS service not properly configured' },
        { status: 500 }
      )
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()

    // Store OTP in memory/database with expiry (5 minutes)
    // In production, use Redis or database
    // For now, we'll return it for demo (REMOVE IN PRODUCTION)
    const otpExpiry = Date.now() + 5 * 60 * 1000 // 5 minutes

    // TODO: Store OTP in database/Redis
    // await storeOTP(phoneNumber, otp, otpExpiry)

    // Format phone number for Zalo (must start with 84)
    const formattedPhone = phoneNumber.startsWith('0')
      ? '84' + phoneNumber.substring(1)
      : phoneNumber.replace('+84', '84')

    // Send OTP via ZNS API
    const znsResponse = await fetch('https://business.openapi.zalo.me/message/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': znsAccessToken,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        template_id: znsTemplateId,
        template_data: {
          otp_code: otp,
          // Add other template parameters as needed
        },
        tracking_id: `otp_${Date.now()}`, // Unique tracking ID
      }),
    })

    const responseText = await znsResponse.text()
    console.log('ZNS API response:', responseText)

    if (!znsResponse.ok) {
      console.error('ZNS API failed:', responseText)
      return NextResponse.json(
        {
          error: 'Failed to send OTP',
          details: responseText,
        },
        { status: 400 }
      )
    }

    const znsData = JSON.parse(responseText)

    if (znsData.error !== 0) {
      console.error('ZNS API error:', znsData)
      return NextResponse.json(
        {
          error: znsData.message || 'Failed to send OTP',
          error_code: znsData.error,
        },
        { status: 400 }
      )
    }

    // ⚠️ DEMO ONLY - REMOVE IN PRODUCTION
    // In production, don't return OTP to client
    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      // REMOVE THIS IN PRODUCTION:
      debug_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      expires_at: otpExpiry,
    })
  } catch (error) {
    console.error('Error sending OTP:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
