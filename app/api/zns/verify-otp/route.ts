import { NextRequest, NextResponse } from 'next/server'

/**
 * ZNS API: Verify OTP
 * Verifies the OTP code entered by user
 */
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, otp } = await request.json()

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      )
    }

    // TODO: Retrieve stored OTP from database/Redis
    // const storedOTP = await getOTP(phoneNumber)
    // const isValid = storedOTP.code === otp && storedOTP.expiresAt > Date.now()

    // For now, simple validation (REPLACE WITH REAL IMPLEMENTATION)
    // In production, check against stored OTP in database

    // ⚠️ DEMO ONLY - REPLACE WITH REAL VALIDATION
    const isValid = otp.length === 6 && /^\d{6}$/.test(otp)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      )
    }

    // TODO: Delete used OTP from storage
    // await deleteOTP(phoneNumber)

    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully',
    })
  } catch (error) {
    console.error('Error verifying OTP:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
