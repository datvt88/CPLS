/**
 * Gemini API Service - Core API Communication Layer
 *
 * Lightweight service for direct Gemini API calls.
 * This module handles:
 * - API key validation
 * - HTTP requests to Gemini API
 * - Error handling and messages
 * - Health checks
 */

import { GEMINI_API_BASE, getValidatedModel, DEFAULT_GEMINI_MODEL } from './models'

// Generation config for Gemini API
const GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
}

/**
 * GeminiAPI: Core API communication service
 */
class GeminiAPI {
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
   * Get API key or throw error
   */
  private getApiKey(): string {
    if (!this.apiKey) {
      console.error('[GeminiAPI] API Key is missing!')
      throw new Error('Gemini API key not configured')
    }
    return this.apiKey
  }

  /**
   * Get human-readable error message from HTTP status
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
   * Call Gemini API with prompt
   * @param prompt - The prompt text to send
   * @param model - Optional model ID (defaults to DEFAULT_GEMINI_MODEL)
   * @returns Generated text response
   */
  async callAPI(prompt: string, model?: string): Promise<string> {
    const apiKey = this.getApiKey()
    const selectedModel = getValidatedModel(model)

    console.log(`[GeminiAPI] Model: ${selectedModel}`)

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
      console.error('[GeminiAPI] Error:', response.status, errorText)
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
   * Health check - Verify API connectivity
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error', message: string }> {
    try {
      if (!this.isConfigured()) {
        return { status: 'error', message: 'API key not configured' }
      }
      await this.callAPI('Ping', DEFAULT_GEMINI_MODEL)
      return { status: 'ok', message: 'Gemini API is working' }
    } catch (error: any) {
      return { status: 'error', message: error.message }
    }
  }
}

// Export singleton instance
export const geminiAPI = new GeminiAPI()
