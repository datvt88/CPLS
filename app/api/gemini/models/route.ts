import { NextResponse } from 'next/server'

// Available Gemini models
const AVAILABLE_MODELS = {
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'Recommended - Best balance of speed and quality',
    recommended: true,
  },
  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    description: 'Fast and reliable',
    recommended: false,
  },
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    description: 'Advanced - Highest intelligence',
    recommended: false,
  },
} as const

export async function GET() {
  return NextResponse.json({
    models: AVAILABLE_MODELS,
    default: 'gemini-2.5-flash',
  })
}
