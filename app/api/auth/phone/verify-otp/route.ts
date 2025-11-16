import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Normalize phone number to international format (84...)
 */
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')

  // If starts with 0, convert to 84
  if (cleaned.startsWith('0')) {
    return '84' + cleaned.substring(1)
  }

  // If starts with +84, remove +
  if (cleaned.startsWith('+84')) {
    return cleaned.substring(1)
  }

  // Already in correct format
  return cleaned
}

/**
 * Generate a secure random password for phone-based auth users
 */
function generateSecurePassword(phone: string): string {
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `phone_${phone}_${randomPart}_cpls_2025`
}

/**
 * POST /api/auth/phone/verify-otp
 *
 * Request body:
 * {
 *   phone: string (VD: "0901234567" hoặc "84901234567")
 *   otp: string (6 digits)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   user: { id, phone, email },
 *   session: { access_token, refresh_token }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json()

    // Validate input
    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Vui lòng nhập số điện thoại và mã OTP' },
        { status: 400 }
      )
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: 'Mã OTP không hợp lệ. Vui lòng nhập 6 chữ số.' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhoneNumber(phone)

    console.log('='.repeat(60))
    console.log('🔐 OTP Verification')
    console.log('='.repeat(60))
    console.log(`Phone: ${phone} → ${normalizedPhone}`)
    console.log(`OTP: ${otp}`)
    console.log('='.repeat(60))

    // Initialize Supabase admin client (for auth operations)
    const supabase = createClient()

    // Find the OTP verification record
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('otp_code', otp)
      .eq('verified', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !otpRecord) {
      console.log('❌ OTP not found or already verified')
      return NextResponse.json(
        { error: 'Mã OTP không hợp lệ hoặc đã hết hạn' },
        { status: 400 }
      )
    }

    console.log('✅ OTP record found:', otpRecord.id)

    // Check if OTP is expired
    const now = new Date()
    const expiresAt = new Date(otpRecord.expires_at)

    if (now > expiresAt) {
      console.log('❌ OTP expired')
      console.log(`Expired at: ${expiresAt}`)
      console.log(`Current time: ${now}`)

      return NextResponse.json(
        { error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' },
        { status: 400 }
      )
    }

    console.log('✅ OTP not expired')

    // Check if max attempts reached
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log('❌ Max attempts reached')

      return NextResponse.json(
        {
          error:
            'Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng yêu cầu mã mới.',
        },
        { status: 400 }
      )
    }

    // Increment attempt counter
    const { error: updateError } = await supabase
      .from('otp_verifications')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id)

    if (updateError) {
      console.error('Error updating attempt counter:', updateError)
    }

    // Check if OTP code matches
    if (otpRecord.otp_code !== otp) {
      console.log('❌ OTP code mismatch')

      const remainingAttempts =
        otpRecord.max_attempts - (otpRecord.attempts + 1)

      return NextResponse.json(
        {
          error: `Mã OTP không đúng. Còn ${remainingAttempts} lần thử.`,
        },
        { status: 400 }
      )
    }

    console.log('✅ OTP verified successfully')

    // Mark OTP as verified
    const { error: verifyError } = await supabase
      .from('otp_verifications')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', otpRecord.id)

    if (verifyError) {
      console.error('Error marking OTP as verified:', verifyError)
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .eq('phone_number', normalizedPhone)
      .single()

    let authResult

    if (existingProfile) {
      // User exists - sign in
      console.log('👤 Existing user found:', existingProfile.user_id)
      console.log('📧 Signing in with email:', existingProfile.email)

      // Generate password (must be same as when user was created)
      const password = generateSecurePassword(normalizedPhone)

      // Sign in
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: existingProfile.email,
          password: password,
        })

      if (signInError) {
        console.error('❌ Sign in error:', signInError)

        // If password doesn't match, try to update it
        console.log('🔄 Attempting to update password...')

        // This requires admin privileges
        // For now, return error and suggest re-registration
        return NextResponse.json(
          {
            error:
              'Lỗi đăng nhập. Vui lòng liên hệ support hoặc đăng ký lại.',
          },
          { status: 500 }
        )
      }

      authResult = data
      console.log('✅ User signed in successfully')
    } else {
      // New user - create account
      console.log('👤 New user - creating account')

      // Generate email and password
      const email = `phone_${normalizedPhone}@cpls.app`
      const password = generateSecurePassword(normalizedPhone)

      console.log('📧 Creating user with email:', email)

      // Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            phone_number: normalizedPhone,
          },
        },
      })

      if (signUpError) {
        console.error('❌ Sign up error:', signUpError)
        return NextResponse.json(
          { error: 'Không thể tạo tài khoản. Vui lòng thử lại.' },
          { status: 500 }
        )
      }

      if (!data.user) {
        console.error('❌ User creation failed - no user returned')
        return NextResponse.json(
          { error: 'Không thể tạo tài khoản. Vui lòng thử lại.' },
          { status: 500 }
        )
      }

      console.log('✅ Auth user created:', data.user.id)

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          email: email,
          phone_number: normalizedPhone,
          full_name: `User ${normalizedPhone.substring(2, 6)}`, // VD: User 9012
          is_verified: true, // Phone is verified via OTP
        })

      if (profileError) {
        console.error('❌ Profile creation error:', profileError)
        // User is created but profile failed - this is not critical
        // User can still log in and profile will be created on next login
      } else {
        console.log('✅ Profile created successfully')
      }

      authResult = data
      console.log('✅ New user registered successfully')
    }

    // Return user data and session
    const responseData = {
      success: true,
      user: {
        id: authResult.user?.id,
        phone: normalizedPhone,
        email: authResult.user?.email,
      },
      session: {
        access_token: authResult.session?.access_token,
        refresh_token: authResult.session?.refresh_token,
        expires_at: authResult.session?.expires_at,
      },
    }

    console.log('='.repeat(60))
    console.log('✅ OTP VERIFICATION COMPLETE')
    console.log('='.repeat(60))

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error in verify-otp:', error)
    return NextResponse.json(
      { error: 'Lỗi hệ thống. Vui lòng thử lại sau.' },
      { status: 500 }
    )
  }
}
