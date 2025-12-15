import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * API Route: Lookup email by phone number
 *
 * This endpoint is used to convert phone number to email for authentication.
 * The actual sign-in happens client-side using the returned email.
 *
 * Security: Returns email only, password verification happens client-side via Supabase Auth
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { phoneNumber } = await request.json()

    console.log('📱 [signin-phone API] Received request for phone:', phoneNumber)

    if (!phoneNumber) {
      console.error('❌ [signin-phone API] Missing phone number')
      return NextResponse.json(
        { error: 'Số điện thoại là bắt buộc' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role to query profiles
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      const missingVars = []
      if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
      if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY')
      console.error(`❌ [signin-phone API] Missing environment variables: ${missingVars.join(', ')}`)
      return NextResponse.json(
        { error: 'Lỗi cấu hình server. Vui lòng liên hệ quản trị viên.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    console.log('🔍 [signin-phone API] Looking up phone in database...')

    // Look up user by phone number with timeout (Supabase has built-in timeout)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('phone_number', phoneNumber)
      .single()

    const elapsed = Date.now() - startTime

    if (profileError) {
      console.error(`❌ [signin-phone API] Query error (${elapsed}ms):`, profileError.message)

      // Distinguish between "not found" and actual errors
      if (profileError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Số điện thoại không tồn tại' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { error: 'Lỗi truy vấn cơ sở dữ liệu' },
        { status: 500 }
      )
    }

    if (!profile) {
      console.error(`❌ [signin-phone API] No profile found (${elapsed}ms)`)
      return NextResponse.json(
        { error: 'Số điện thoại không tồn tại' },
        { status: 404 }
      )
    }

    console.log(`✅ [signin-phone API] Found email for phone (${elapsed}ms):`, profile.email)

    // Return email for client-side authentication
    return NextResponse.json({
      email: profile.email,
    })
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`❌ [signin-phone API] Unexpected error (${elapsed}ms):`, error)
    return NextResponse.json(
      { error: 'Đã có lỗi xảy ra. Vui lòng thử lại.' },
      { status: 500 }
    )
  }
}
