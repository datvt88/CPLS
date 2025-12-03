import { NextResponse } from 'next/server'

/**
 * Health Check & Environment Validation Endpoint
 *
 * Use this to verify:
 * - API is accessible
 * - Environment variables are loaded correctly
 * - Supabase connection can be established
 *
 * Usage:
 * - GET /api/health - Returns environment status
 */
export async function GET() {
  const envStatus = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,

    // Check Supabase env vars (without exposing values)
    supabase: {
      url: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        isPlaceholder: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('placeholder'),
        format: process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://') ? 'valid' : 'invalid',
        domain: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('.supabase.co') ? 'valid' : 'invalid',
      },
      anonKey: {
        exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        isPlaceholder: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('placeholder'),
        format: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith('eyJ') ? 'valid' : 'invalid',
        length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      },
      serviceRoleKey: {
        exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        format: process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ') ? 'valid' : 'invalid',
        length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      },
    },

    // Check optional env vars
    optional: {
      geminiApiKey: !!process.env.GEMINI_API_KEY,
      znsAccessToken: !!process.env.ZNS_ACCESS_TOKEN,
    },
  }

  // Determine overall health
  const isHealthy =
    envStatus.supabase.url.exists &&
    !envStatus.supabase.url.isPlaceholder &&
    envStatus.supabase.url.format === 'valid' &&
    envStatus.supabase.url.domain === 'valid' &&
    envStatus.supabase.anonKey.exists &&
    !envStatus.supabase.anonKey.isPlaceholder &&
    envStatus.supabase.anonKey.format === 'valid' &&
    envStatus.supabase.serviceRoleKey.exists &&
    envStatus.supabase.serviceRoleKey.format === 'valid'

  const statusCode = isHealthy ? 200 : 500

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    message: isHealthy
      ? 'All environment variables are configured correctly'
      : 'Environment variables are missing or invalid',
    details: envStatus,

    // Helpful troubleshooting
    troubleshooting: isHealthy ? null : {
      message: 'Environment variables not configured properly',
      actions: [
        'Verify environment variables are set in Vercel Dashboard',
        'Check Settings → Environment Variables',
        'Ensure variables are set for the correct environment (Production/Preview/Development)',
        'Redeploy after updating environment variables',
      ],
      documentation: '/SETUP_INSTRUCTIONS.md',
    },
  }

  return NextResponse.json(response, { status: statusCode })
}
