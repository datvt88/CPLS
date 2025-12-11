import { NextRequest, NextResponse } from 'next/server'
import { geminiDeepAnalysis, isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Handle both formats:
    // 1. Direct: { symbol, technicalData, ... }
    // 2. Wrapped: { type: 'full_context', data: { symbol, technicalData, ... } }
    let payload: any
    if (body.type === 'full_context' && body.data) {
      payload = body.data
    } else {
      payload = body
    }

    const { symbol, technicalData, fundamentalData, recommendations, model } = payload

    // Validate input
    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { error: 'Invalid symbol', code: 'INVALID_SYMBOL' },
        { status: 400 }
      )
    }

    // Check if we have minimum required data
    if (!technicalData?.currentPrice) {
      return NextResponse.json(
        { error: 'Missing technical data', code: 'MISSING_DATA' },
        { status: 400 }
      )
    }

    // Validate and set model
    const selectedModel = model && isValidModel(model) ? model : DEFAULT_GEMINI_MODEL
    console.log('[Stock Analysis API] Model:', selectedModel, '| Symbol:', symbol)

    // Call Gemini Deep Analysis service
    const result = await geminiDeepAnalysis.analyze({
      symbol,
      technicalData,
      fundamentalData,
      recommendations,
      model: selectedModel
    })

    console.log('[Stock Analysis API] Completed for', symbol)

    return NextResponse.json({
      ...result,
      symbol,
      timestamp: Date.now()
    })
  } catch (error: any) {
    console.error('[Stock Analysis API] Error:', error.message)

    // Handle specific error types
    if (error.message?.includes('API key') || error.message?.includes('not configured')) {
      return NextResponse.json(
        { error: 'Gemini API chưa được cấu hình', code: 'API_NOT_CONFIGURED' },
        { status: 500 }
      )
    }

    if (error.message?.includes('Rate limit')) {
      return NextResponse.json(
        { error: 'Vượt quá giới hạn API. Vui lòng thử lại sau.', code: 'RATE_LIMIT' },
        { status: 429 }
      )
    }

    if (error.message?.includes('Failed to connect') || error.message?.includes('fetch')) {
      return NextResponse.json(
        { error: 'Không thể kết nối với Gemini API', code: 'CONNECTION_ERROR' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Lỗi hệ thống', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  try {
    const { geminiAPI } = await import('@/lib/gemini')

    const isConfigured = geminiAPI.isConfigured()

    if (!isConfigured) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'Gemini API key chưa được cấu hình',
        ready: false
      })
    }

    // Quick health check
    const health = await geminiAPI.healthCheck()

    return NextResponse.json({
      status: health.status,
      message: health.message,
      ready: health.status === 'ok',
      model: DEFAULT_GEMINI_MODEL
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Không thể kiểm tra API',
      ready: false
    })
  }
}
