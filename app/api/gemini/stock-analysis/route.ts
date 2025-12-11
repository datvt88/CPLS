import { NextRequest, NextResponse } from 'next/server'
import { geminiDeepAnalysis, isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const { symbol, technicalData, fundamentalData, recommendations, model } = await request.json()

    // Validate input
    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { error: 'Invalid symbol' },
        { status: 400 }
      )
    }

    // Validate and set model
    const selectedModel = model && isValidModel(model) ? model : DEFAULT_GEMINI_MODEL
    console.log('🤖 Stock Analysis API: Using model:', selectedModel, 'Symbol:', symbol)

    // Call Gemini Deep Analysis service
    const result = await geminiDeepAnalysis.analyze({
      symbol,
      technicalData,
      fundamentalData,
      recommendations,
      model: selectedModel
    })

    console.log('✅ Stock Analysis API: Completed for', symbol)

    return NextResponse.json({
      ...result,
      symbol
    })
  } catch (error: any) {
    console.error('Stock analysis API error:', error)

    // Handle specific error types
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    if (error.message?.includes('Rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
