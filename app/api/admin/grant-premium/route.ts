import { NextRequest, NextResponse } from 'next/server'
import { profileService } from '@/services/profile.service'
import { authService } from '@/services/auth.service'

/**
 * Grant Premium membership to current user
 * For testing purposes only
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user
    const { user, error: authError } = await authService.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      )
    }

    // Get duration from request (default: 1 year)
    const body = await request.json().catch(() => ({}))
    const durationDays = body.durationDays || 365

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + durationDays)

    // Update membership to premium
    const { profile, error } = await profileService.updateMembership(
      user.id,
      'premium',
      expiresAt.toISOString()
    )

    if (error) {
      console.error('Error granting premium:', error)
      return NextResponse.json(
        { error: 'Failed to grant premium membership' },
        { status: 500 }
      )
    }

    console.log(`✅ Premium granted to user ${user.email} until ${expiresAt.toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Premium membership granted successfully! 🎉',
      profile: {
        email: profile?.email,
        membership: profile?.membership,
        expiresAt: profile?.membership_expires_at,
      },
      expiresIn: `${durationDays} days`,
    })
  } catch (error) {
    console.error('Grant premium error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Remove Premium membership (revert to free)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get current user
    const { user, error: authError } = await authService.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      )
    }

    // Update membership to free
    const { profile, error } = await profileService.updateMembership(
      user.id,
      'free',
      undefined
    )

    if (error) {
      console.error('Error removing premium:', error)
      return NextResponse.json(
        { error: 'Failed to remove premium membership' },
        { status: 500 }
      )
    }

    console.log(`✅ Premium removed from user ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Reverted to free membership',
      profile: {
        email: profile?.email,
        membership: profile?.membership,
      },
    })
  } catch (error) {
    console.error('Remove premium error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Check current membership status
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const { user, error: authError } = await authService.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      )
    }

    // Get profile
    const { profile, error } = await profileService.getProfile(user.id)

    if (error || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Check if premium
    const isPremium = await profileService.isPremium(user.id)

    return NextResponse.json({
      userId: user.id,
      email: profile.email,
      membership: profile.membership,
      expiresAt: profile.membership_expires_at,
      isPremium,
      status: isPremium ? '✅ Premium Active' : '🆓 Free Plan',
    })
  } catch (error) {
    console.error('Check membership error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
