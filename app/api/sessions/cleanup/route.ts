import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cleanup API endpoint - removes expired and inactive sessions
 * Can be called by:
 * 1. Cron job (scheduled daily/weekly)
 * 2. Manual trigger
 * 3. Application startup
 */
export async function POST(request: Request) {
  try {
    const now = new Date().toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Delete expired sessions (expires_at < now)
    const { error: expiredError, count: expiredCount } = await supabase
      .from('user_sessions')
      .delete()
      .lt('expires_at', now)

    if (expiredError) {
      console.error('Error deleting expired sessions:', expiredError)
    }

    // 2. Delete inactive sessions older than 30 days
    const { error: inactiveError, count: inactiveCount } = await supabase
      .from('user_sessions')
      .delete()
      .eq('is_active', false)
      .lt('created_at', thirtyDaysAgo)

    if (inactiveError) {
      console.error('Error deleting inactive sessions:', inactiveError)
    }

    // 3. Delete sessions with no activity for 60 days
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { error: staleError, count: staleCount } = await supabase
      .from('user_sessions')
      .delete()
      .lt('last_activity', sixtyDaysAgo)

    if (staleError) {
      console.error('Error deleting stale sessions:', staleError)
    }

    const totalCleaned = (expiredCount || 0) + (inactiveCount || 0) + (staleCount || 0)

    console.log(`✅ Session cleanup completed:
      - Expired: ${expiredCount || 0}
      - Inactive (>30d): ${inactiveCount || 0}
      - Stale (>60d): ${staleCount || 0}
      - Total cleaned: ${totalCleaned}`)

    return NextResponse.json({
      success: true,
      cleaned: {
        expired: expiredCount || 0,
        inactive: inactiveCount || 0,
        stale: staleCount || 0,
        total: totalCleaned
      },
      timestamp: now
    })
  } catch (error: any) {
    console.error('Session cleanup error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Cleanup failed'
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check cleanup stats (without deleting)
 */
export async function GET() {
  try {
    const now = new Date().toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

    // Count sessions to be cleaned
    const { count: expiredCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', now)

    const { count: inactiveCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false)
      .lt('created_at', thirtyDaysAgo)

    const { count: staleCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .lt('last_activity', sixtyDaysAgo)

    const { count: totalCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })

    const { count: activeCount } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('expires_at', now)

    return NextResponse.json({
      total_sessions: totalCount || 0,
      active_sessions: activeCount || 0,
      to_be_cleaned: {
        expired: expiredCount || 0,
        inactive: inactiveCount || 0,
        stale: staleCount || 0,
        total: (expiredCount || 0) + (inactiveCount || 0) + (staleCount || 0)
      },
      timestamp: now
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get stats'
      },
      { status: 500 }
    )
  }
}
