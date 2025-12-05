import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface ResetPasswordRequest {
  user_id: string
  new_password: string
}

// Helper function to get Supabase Admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    // Create admin client
    const supabaseAdmin = getSupabaseAdmin()

    // Get current user session to verify admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: currentUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if current user is admin or mod
    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (profileError || !currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'mod')) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Parse request body
    const body: ResetPasswordRequest = await request.json()

    // Validate required fields
    if (!body.user_id || !body.new_password) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, new_password' },
        { status: 400 }
      )
    }

    // Validate password length
    if (body.new_password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if target user exists
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, phone_number')
      .eq('id', body.user_id)
      .single()

    if (targetError || !targetProfile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Reset password using Supabase Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      body.user_id,
      { password: body.new_password }
    )

    if (updateError) {
      console.error('Error resetting password:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to reset password' },
        { status: 500 }
      )
    }

    // Log the action
    console.log(`✅ Admin ${currentProfile.role} (${currentUser.email}) reset password for user ${targetProfile.email}`)

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      user: {
        id: targetProfile.id,
        email: targetProfile.email,
        full_name: targetProfile.full_name,
        phone_number: targetProfile.phone_number
      }
    })

  } catch (error: any) {
    console.error('Error in reset-password API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
