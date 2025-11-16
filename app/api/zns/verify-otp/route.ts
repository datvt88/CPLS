import { NextRequest, NextResponse } from 'next/server'
import { otpService } from '@/services/otp.service'

/**
 * ZNS API: Verify OTP
 * Verifies the OTP code entered by user against stored OTP in database
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

    // Validate OTP format
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'OTP must be a 6-digit number' },
        { status: 400 }
      )
    }

    console.log('Verifying OTP for phone:', phoneNumber)

    // Verify OTP from database
    const verificationResult = await otpService.verifyOTP(phoneNumber, otp)

    if (!verificationResult.valid) {
      console.log('❌ OTP verification failed:', verificationResult.error)
      return NextResponse.json(
        { error: verificationResult.error || 'Invalid or expired OTP' },
        { status: 400 }
      )
    }

    console.log('✅ OTP verified successfully for', phoneNumber)

    // Delete the used OTP to prevent reuse
    await otpService.deleteOTP(phoneNumber)

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
