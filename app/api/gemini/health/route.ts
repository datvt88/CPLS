import { NextRequest, NextResponse } from 'next/server'

/**
 * Health check endpoint for Gemini API
 * Returns connection status without using quota
 */
export async function GET(request: NextRequest) {
  try {
    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Gemini API key not configured',
        details: 'GEMINI_API_KEY environment variable is missing',
        configured: false,
        available: false,
      })
    }

    // Quick test with minimal prompt to check API availability
    // Note: Using gemini-2.5-flash-live (Gemini 1.5 models retired April 2025)
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-live:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'ping',
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
        }),
      }
    )

    if (response.ok) {
      return NextResponse.json({
        status: 'success',
        message: 'Gemini API is available',
        configured: true,
        available: true,
        model: 'gemini-2.5-flash-live',
      })
    } else {
      const errorText = await response.text()

      let message = 'Gemini API error'
      if (response.status === 403) {
        message = 'API key is invalid or disabled'
      } else if (response.status === 404) {
        message = 'Gemini model not found'
      } else if (response.status === 429) {
        message = 'Rate limit exceeded'
      }

      return NextResponse.json({
        status: 'error',
        message,
        details: errorText,
        configured: true,
        available: false,
        statusCode: response.status,
      })
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Failed to check Gemini API',
      details: error instanceof Error ? error.message : 'Unknown error',
      configured: !!process.env.GEMINI_API_KEY,
      available: false,
    })
  }
}
