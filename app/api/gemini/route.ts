import { NextRequest, NextResponse } from 'next/server'
import { parseGeminiResponse } from '@/lib/geminiClient'

export async function POST(request: NextRequest) {
  try {
    const { prompt, user_id } = await request.json()

    // Validate input
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid prompt' },
        { status: 400 }
      )
    }

    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Phân tích tín hiệu trading cho ${prompt}. Trả về JSON với format: {"signal": "BUY|SELL|HOLD", "confidence": 0-100, "summary": "mô tả chi tiết"}`,
                },
              ],
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to generate signal from Gemini API' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!generatedText) {
      return NextResponse.json(
        { error: 'No content generated from Gemini' },
        { status: 500 }
      )
    }

    // Parse the response
    const result = parseGeminiResponse(generatedText)

    return NextResponse.json(result)
  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
