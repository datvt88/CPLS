import { NextResponse } from 'next/server'
import { geminiHub } from '@/lib/gemini/hub'

export const runtime = 'edge' // Optional: dùng edge function cho nhanh

export async function GET() {
  try {
    // Bây giờ hàm này đã tồn tại trong geminiHub
    if (!geminiHub.isConfigured()) {
      return NextResponse.json({
        status: 'error',
        message: 'Gemini API key not configured (Check .env)'
      }, { status: 503 })
    }

    // Gọi hàm healthCheck thực tế
    const health = await geminiHub.healthCheck()
    
    if (health.status === 'error') {
       return NextResponse.json(health, { status: 502 })
    }

    return NextResponse.json(health)
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message
    }, { status: 500 })
  }
}
