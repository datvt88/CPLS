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
  try {
    const { phoneNumber } = await request.json()

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Số điện thoại là bắt buộc' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role to query profiles
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Look up user by phone number
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('phone_number', phoneNumber)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Số điện thoại không tồn tại' },
        { status: 404 }
      )
    }

    // Return email for client-side authentication
    return NextResponse.json({
      email: profile.email,
    })
  } catch (error) {
    console.error('Error in phone lookup:', error)
    return NextResponse.json(
      { error: 'Đã có lỗi xảy ra' },
      { status: 500 }
    )
  }
}
