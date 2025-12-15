import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface SetPasswordRequest {
  newPassword: string
  currentPassword?: string
}

/**
 * API Route: Set or update password for authenticated user
 *
 * This endpoint uses the Supabase Admin API to properly set password
 * for users regardless of their original auth provider (OAuth, email, etc.)
 *
 * This is necessary because supabase.auth.updateUser({ password }) may not
 * work correctly for OAuth users who don't have an email identity set up.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Không có quyền truy cập' },
        { status: 401 }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      const missingVars = []
      if (!supabaseUrl) missingVars.push('NEXT_PUBLIC_SUPABASE_URL')
      if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_ROLE_KEY')
      console.error(`❌ [set-password API] Missing environment variables: ${missingVars.join(', ')}`)
      return NextResponse.json(
        { error: 'Lỗi cấu hình server. Vui lòng liên hệ quản trị viên để kiểm tra cấu hình SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('❌ [set-password API] Invalid token:', authError?.message)
      return NextResponse.json(
        { error: 'Token không hợp lệ. Vui lòng đăng nhập lại.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body: SetPasswordRequest = await request.json()

    // Validate password
    if (!body.newPassword || body.newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      )
    }

    // Check if user already has a password set
    const providers = user.app_metadata?.providers || []
    const hasEmailProvider = providers.includes('email')
    const hasPasswordFlag = user.user_metadata?.has_password === true
    const userHasPassword = hasEmailProvider || hasPasswordFlag

    // If user already has a password, verify the current password
    if (userHasPassword) {
      if (!body.currentPassword) {
        return NextResponse.json(
          { error: 'Vui lòng nhập mật khẩu hiện tại' },
          { status: 400 }
        )
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: user.email || '',
        password: body.currentPassword
      })

      if (signInError) {
        console.error('❌ [set-password API] Current password verification failed:', signInError.message)
        return NextResponse.json(
          { error: 'Mật khẩu hiện tại không đúng' },
          { status: 400 }
        )
      }
    }

    console.log(`🔐 [set-password API] Setting password for user: ${user.email}`)

    // Use admin API to update user password and mark that password has been set
    // This works regardless of auth provider (OAuth, email, etc.)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { 
        password: body.newPassword,
        user_metadata: {
          ...user.user_metadata,
          has_password: true
        }
      }
    )

    const elapsed = Date.now() - startTime

    if (updateError) {
      console.error(`❌ [set-password API] Failed (${elapsed}ms):`, updateError.message)
      return NextResponse.json(
        { error: updateError.message || 'Không thể cập nhật mật khẩu' },
        { status: 500 }
      )
    }

    console.log(`✅ [set-password API] Password set successfully (${elapsed}ms) for user: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Cập nhật mật khẩu thành công'
    })

  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`❌ [set-password API] Unexpected error (${elapsed}ms):`, error)
    return NextResponse.json(
      { error: 'Đã có lỗi xảy ra. Vui lòng thử lại.' },
      { status: 500 }
    )
  }
}
