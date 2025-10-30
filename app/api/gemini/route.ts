import { NextRequest, NextResponse } from 'next/server'
import { parseGeminiResponse } from '@/lib/geminiClient'

interface GeminiRequest {
  prompt: string
  user_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: GeminiRequest = await request.json()
    const { prompt, user_id } = body

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a financial analyst. Analyze this stock/market: ${prompt}. 
            Provide your analysis in this JSON format:
            {
              "signal": "BUY" | "SELL" | "HOLD",
              "confidence": <number 0-100>,
              "summary": "<brief analysis>"
            }`
          }]
        }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to get response from Gemini API' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Parse the response using the existing parser
    const parsedResult = parseGeminiResponse(text)

    // Log for analytics (optional)
    if (user_id) {
      console.log(`AI Signal request from user ${user_id}: ${prompt}`)
    }

    return NextResponse.json(parsedResult)
  } catch (error) {
    console.error('Gemini API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
