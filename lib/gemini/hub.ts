/**
 * Gemini Hub - Central coordinator for all Gemini AI services
 *
 * Architecture:
 * ┌──────────┐        ┌──────────────────┐
 * │   User   │───────►│   API Gemini AI  │
 * └────┬─────┘        └────────┬─────────┘
 *      │                       │
 *      ▼                       ▼
 * ┌──────────┐        ┌───────────────────┐
 * │chat room │───────►│   Gemini Alpha    │
 * └────┬─────┘        └───────────────────┘
 *      │
 *      ▼
 * ┌──────────┐        ┌───────────────────┐
 * │  /stock  │◄──────►│ Gemini Deep       │
 * │  (HUB)   │        │ Analysis          │
 * └──────────┘        └───────────────────┘
 */

import { GEMINI_API_BASE, getValidatedModel, DEFAULT_GEMINI_MODEL } from './models'
import { parseSignalResponse, parseDeepAnalysisResponse } from './parser'
import type { AnalysisResult, DeepAnalysisResult, DeepAnalysisRequest, AlphaResponse } from './types'

// Generation config for Gemini API
const GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
}

/**
 * Gemini Hub - Singleton coordinator
 */
class GeminiHub {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey
  }

  /**
   * Get API key (throws if not configured)
   */
  private getApiKey(): string {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured')
    }
    return this.apiKey
  }

  /**
   * Call Gemini API
   */
  async callGeminiAPI(prompt: string, model?: string): Promise<string> {
    const apiKey = this.getApiKey()
    const selectedModel = getValidatedModel(model)

    console.log('🤖 GeminiHub: Calling API with model:', selectedModel)

    const response = await fetch(
      `${GEMINI_API_BASE}/${selectedModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: GENERATION_CONFIG,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('GeminiHub API error:', response.status, errorText)
      throw new Error(this.getErrorMessage(response.status))
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!generatedText) {
      throw new Error('No content generated from Gemini')
    }

    return generatedText
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(status: number): string {
    switch (status) {
      case 400: return 'Invalid request to Gemini API'
      case 403: return 'API key is invalid or has been disabled'
      case 404: return 'Gemini API model not found'
      case 429: return 'Rate limit exceeded. Please try again later.'
      default: return status >= 500
        ? 'Gemini API server error. Please try again later.'
        : 'Failed to connect to Gemini API'
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error', message: string }> {
    try {
      if (!this.isConfigured()) {
        return { status: 'error', message: 'API key not configured' }
      }

      await this.callGeminiAPI('Hello', DEFAULT_GEMINI_MODEL)
      return { status: 'ok', message: 'Gemini API is working' }
    } catch (error: any) {
      return { status: 'error', message: error.message }
    }
  }
}

// Export singleton instance
export const geminiHub = new GeminiHub()

// Re-export types and utilities
export { parseSignalResponse, parseDeepAnalysisResponse } from './parser'
export { getValidatedModel, DEFAULT_GEMINI_MODEL, isValidModel, getActiveModels } from './models'
export type { AnalysisResult, DeepAnalysisResult, DeepAnalysisRequest, AlphaResponse } from './types'
