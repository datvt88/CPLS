import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface CreateUserRequest {
  email: string
  phone_number: string
  password: string
  full_name?: string
  nickname?: string
  membership: 'free' | 'premium'
  role: 'user' | 'mod' | 'admin'
  membership_expires_at?: string
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
    const body: CreateUserRequest = await request.json()

    // Validate required fields
    if (!body.email || !body.phone_number || !body.password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, phone_number, password' },
        { status: 400 }
      )
    }

    // Validate phone number format
    const phoneRegex = /^[0-9+\-\s()]{9,20}$/
    if (!phoneRegex.test(body.phone_number)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if phone number already exists in profiles
    const { data: existingProfile, error: phoneCheckError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone_number', body.phone_number)
      .maybeSingle()

    if (phoneCheckError) {
      console.error('Error checking phone number:', phoneCheckError)
      return NextResponse.json({ error: 'Error checking phone number' }, { status: 500 })
    }

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: body.full_name || '',
        phone_number: body.phone_number
      }
    })

    if (createError || !newUser.user) {
      console.error('Error creating user:', createError)
      return NextResponse.json(
        { error: createError?.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create profile in profiles table
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: body.email,
        phone_number: body.phone_number,
        full_name: body.full_name || null,
        nickname: body.nickname || null,
        membership: body.membership,
        role: body.role,
        membership_expires_at: body.membership_expires_at || null,
        provider: 'admin-created'
      })

    if (profileInsertError) {
      console.error('Error creating profile:', profileInsertError)

      // Rollback: Delete the auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)

      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    // Return success with user data (excluding password)
    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user.id,
        email: body.email,
        phone_number: body.phone_number,
        full_name: body.full_name,
        membership: body.membership,
        role: body.role
      }
    })

  } catch (error: any) {
    console.error('Error in create-user API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
