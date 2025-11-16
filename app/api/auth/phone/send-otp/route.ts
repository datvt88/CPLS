import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Phone number validation for Vietnam
 * Supports formats:
 * - 0901234567 (10 digits starting with 0)
 * - 84901234567 (country code + 9 digits)
 * - +84901234567 (with + prefix)
 */
function validatePhoneNumber(phone: string): {
  isValid: boolean
  normalized?: string
  error?: string
} {
  // Remove all spaces and special characters except +
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')

  // Pattern 1: 0XXXXXXXXX (10 digits starting with 0)
  const pattern1 = /^0[3-9]\d{8}$/
  if (pattern1.test(cleaned)) {
    // Convert to international format (84...)
    const normalized = '84' + cleaned.substring(1)
    return { isValid: true, normalized }
  }

  // Pattern 2: 84XXXXXXXXX (country code + 9 digits)
  const pattern2 = /^84[3-9]\d{8}$/
  if (pattern2.test(cleaned)) {
    return { isValid: true, normalized: cleaned }
  }

  // Pattern 3: +84XXXXXXXXX (with + prefix)
  const pattern3 = /^\+84[3-9]\d{8}$/
  if (pattern3.test(cleaned)) {
    return { isValid: true, normalized: cleaned.substring(1) }
  }

  return {
    isValid: false,
    error: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (VD: 0901234567)',
  }
}

/**
 * Generate a 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Get Zalo access token from refresh token
 */
async function getZaloAccessToken(): Promise<string | null> {
  const refreshToken = process.env.ZALO_REFRESH_TOKEN
  const appId = process.env.ZALO_APP_ID
  const appSecret = process.env.ZALO_APP_SECRET

  // If direct access token is provided, use it
  if (process.env.ZALO_ACCESS_TOKEN) {
    return process.env.ZALO_ACCESS_TOKEN
  }

  if (!refreshToken || !appId || !appSecret) {
    console.warn('Zalo credentials not configured, using mock mode')
    return null
  }

  try {
    const response = await fetch(
      'https://oauth.zaloapp.com/v4/oa/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          secret_key: appSecret,
        },
        body: new URLSearchParams({
          app_id: appId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      }
    )

    const data = await response.json()

    if (data.access_token) {
      return data.access_token
    }

    console.error('Failed to get Zalo access token:', data)
    return null
  } catch (error) {
    console.error('Error getting Zalo access token:', error)
    return null
  }
}

/**
 * Send OTP via Zalo ZNS
 */
async function sendOTPViaZNS(
  phone: string,
  otpCode: string
): Promise<{ success: boolean; error?: string; mockMode?: boolean }> {
  const accessToken = await getZaloAccessToken()
  const templateId = process.env.ZALO_ZNS_TEMPLATE_ID

  // Mock mode if credentials not configured
  if (!accessToken || !templateId) {
    console.log('='.repeat(60))
    console.log('🧪 MOCK MODE: Zalo ZNS')
    console.log('='.repeat(60))
    console.log(`Phone: ${phone}`)
    console.log(`OTP Code: ${otpCode}`)
    console.log(`Expires: 5 minutes`)
    console.log('='.repeat(60))
    console.log('⚠️  To enable real ZNS, configure:')
    console.log('   - ZALO_APP_ID')
    console.log('   - ZALO_APP_SECRET')
    console.log('   - ZALO_REFRESH_TOKEN (or ZALO_ACCESS_TOKEN)')
    console.log('   - ZALO_ZNS_TEMPLATE_ID')
    console.log('='.repeat(60))

    return { success: true, mockMode: true }
  }

  try {
    const response = await fetch(
      'https://business.openapi.zalo.me/message/template',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: accessToken,
        },
        body: JSON.stringify({
          phone: phone,
          template_id: templateId,
          template_data: {
            otp_code: otpCode,
            expire_time: '5',
          },
          tracking_id: `otp_${Date.now()}`,
        }),
      }
    )

    const data = await response.json()

    if (data.error === 0) {
      console.log('✅ OTP sent successfully via Zalo ZNS')
      console.log('Message ID:', data.data?.msg_id)
      return { success: true }
    }

    console.error('❌ Failed to send OTP via Zalo ZNS:', data)
    return {
      success: false,
      error: data.message || 'Failed to send OTP',
    }
  } catch (error) {
    console.error('Error sending OTP via Zalo ZNS:', error)
    return {
      success: false,
      error: 'Network error while sending OTP',
    }
  }
}

/**
 * Check rate limit for phone number and IP
 */
async function checkRateLimit(
  supabase: any,
  phone: string,
  ip: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check phone rate limit
    const { data: phoneLimit, error: phoneLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        p_identifier: phone,
        p_type: 'phone',
        p_max_requests: 3, // Max 3 OTP per hour per phone
      }
    )

    if (phoneLimitError) {
      console.error('Error checking phone rate limit:', phoneLimitError)
      // Continue anyway - don't block on rate limit check failure
    }

    if (phoneLimit === false) {
      return {
        allowed: false,
        reason: 'Bạn đã gửi quá nhiều mã OTP. Vui lòng thử lại sau 1 giờ.',
      }
    }

    // Check IP rate limit
    const { data: ipLimit, error: ipLimitError } = await supabase.rpc(
      'check_rate_limit',
      {
        p_identifier: ip,
        p_type: 'ip',
        p_max_requests: 10, // Max 10 OTP per hour per IP
      }
    )

    if (ipLimitError) {
      console.error('Error checking IP rate limit:', ipLimitError)
      // Continue anyway
    }

    if (ipLimit === false) {
      return {
        allowed: false,
        reason:
          'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.',
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error in rate limit check:', error)
    // On error, allow the request (fail open)
    return { allowed: true }
  }
}

/**
 * POST /api/auth/phone/send-otp
 *
 * Request body:
 * {
 *   phone: string (VD: "0901234567" hoặc "84901234567")
 *   purpose: "registration" | "login" (optional, default: "login")
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "OTP đã được gửi đến số điện thoại của bạn",
 *   expiresIn: 300 (seconds)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { phone, purpose = 'login' } = await request.json()

    // Validate input
    if (!phone) {
      return NextResponse.json(
        { error: 'Vui lòng nhập số điện thoại' },
        { status: 400 }
      )
    }

    // Validate phone number format
    const validation = validatePhoneNumber(phone)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const normalizedPhone = validation.normalized!

    // Get client IP address
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    console.log('='.repeat(60))
    console.log('📱 OTP Request')
    console.log('='.repeat(60))
    console.log(`Phone: ${phone} → ${normalizedPhone}`)
    console.log(`Purpose: ${purpose}`)
    console.log(`IP: ${ip}`)
    console.log('='.repeat(60))

    // Initialize Supabase client
    const supabase = createClient()

    // Check rate limits
    const rateLimitCheck = await checkRateLimit(
      supabase,
      normalizedPhone,
      ip
    )
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: rateLimitCheck.reason },
        { status: 429 }
      )
    }

    // For registration, check if phone already exists
    if (purpose === 'registration') {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .single()

      if (existingProfile) {
        return NextResponse.json(
          {
            error:
              'Số điện thoại này đã được đăng ký. Vui lòng đăng nhập.',
          },
          { status: 409 }
        )
      }
    }

    // For login, check if phone exists
    if (purpose === 'login') {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', normalizedPhone)
        .single()

      if (!existingProfile) {
        return NextResponse.json(
          {
            error:
              'Số điện thoại chưa được đăng ký. Vui lòng đăng ký trước.',
          },
          { status: 404 }
        )
      }
    }

    // Generate OTP
    const otpCode = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('otp_verifications')
      .insert({
        phone_number: normalizedPhone,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString(),
        purpose,
        ip_address: ip,
      })

    if (insertError) {
      console.error('Error storing OTP:', insertError)
      return NextResponse.json(
        { error: 'Không thể tạo mã OTP. Vui lòng thử lại.' },
        { status: 500 }
      )
    }

    console.log('✅ OTP stored in database')

    // Send OTP via Zalo ZNS
    const sendResult = await sendOTPViaZNS(normalizedPhone, otpCode)

    if (!sendResult.success) {
      return NextResponse.json(
        {
          error:
            sendResult.error ||
            'Không thể gửi mã OTP. Vui lòng thử lại.',
        },
        { status: 500 }
      )
    }

    console.log('✅ OTP request completed successfully')

    return NextResponse.json({
      success: true,
      message: sendResult.mockMode
        ? `🧪 MOCK MODE: Mã OTP của bạn là ${otpCode} (check console logs)`
        : 'Mã OTP đã được gửi đến Zalo của bạn',
      expiresIn: 300, // 5 minutes in seconds
      mockMode: sendResult.mockMode,
    })
  } catch (error) {
    console.error('Error in send-otp:', error)
    return NextResponse.json(
      { error: 'Lỗi hệ thống. Vui lòng thử lại sau.' },
      { status: 500 }
    )
  }
}
