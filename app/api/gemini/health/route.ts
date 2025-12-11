import { NextRequest, NextResponse } from 'next/server'
import { geminiAPI, DEFAULT_GEMINI_MODEL } from '@/lib/gemini'

/**
 * Health check endpoint for Gemini API
 * Returns connection status without using quota
 */
export async function GET(request: NextRequest) {
  try {
    // Check if API key exists
    if (!geminiAPI.isConfigured()) {
      return NextResponse.json({
        status: 'error',
        message: 'Gemini API key not configured',
        details: 'GEMINI_API_KEY environment variable is missing',
        configured: false,
        available: false,
      })
    }

    // Check health via API
    const health = await geminiAPI.healthCheck()

    if (health.status === 'ok') {
      return NextResponse.json({
        status: 'success',
        message: 'Gemini API is available',
        configured: true,
        available: true,
        model: DEFAULT_GEMINI_MODEL,
      })
    } else {
      return NextResponse.json({
        status: 'error',
        message: health.message,
        configured: true,
        available: false,
      })
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check Gemini API',
      details: error instanceof Error ? error.message : 'Unknown error',
      configured: geminiAPI.isConfigured(),
      available: false,
    })
  }
}
