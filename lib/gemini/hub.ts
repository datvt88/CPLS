/**
 * Gemini Hub - Central Coordinator & Router
 *
 * Architecture Implementation based on Diagram:
 *
 * ┌──────┐      ┌──────────────────────────┐
 * │ User │ ────►│      API Gemini AI       │◄───┐
 * └─┬──▲─┘      └──────┬────────────▲──────┘    │
 * │  │               │            │           │
 * │  │          (Call API)    (Call API)      │
 * │  │               ▼            ▼           │
 * ┌─▼──┴─────┐  ┌──────────────┐  ┌─────────────┴─────┐
 * │ Chat Room│◄►│ Gemini Alpha │  │Gemini Deep Analysis│
 * └──────────┘  └──────┬───────┘  └──────▲────────────┘
 * │                 │
 * │ (Forward Ticker)│
 * ▼                 │
 * ┌──────────────┐         │
 * /stock (User)─►│     HUB      │─────────┘
 * Input HPG     └──────────────┘
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
 * GeminiHub: Lớp trung tâm quản lý luồng dữ liệu (The HUB)
 */
class GeminiHub {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY
  }

  // --- Configuration & Utilities ---

  isConfigured(): boolean {
    return !!this.apiKey
  }

  private getApiKey(): string {
    if (!this.apiKey) {
      console.error('❌ GeminiHub: API Key is missing!')
      throw new Error('Gemini API key not configured')
    }
    return this.apiKey
  }

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

  // --- Core API Layer (Node: API Gemini AI) ---

  /**
   * Hàm gọi API gốc (Core function interacting with Google Gemini)
   * Các module Alpha và Deep Analysis đều sử dụng hàm này.
   */
  async callGeminiAPI(prompt: string, model?: string): Promise<string> {
    const apiKey = this.getApiKey()
    const selectedModel = getValidatedModel(model)

    console.log(`🤖 [API Call] Model: ${selectedModel}`)

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

  // --- Module: Gemini Alpha (Chat & Quick Signal) ---

  /**
   * Xử lý hội thoại thông thường.
   * Nếu Alpha phát hiện mã chứng khoán, nó có thể trả về tín hiệu để HUB xử lý tiếp.
   */
  async chatWithAlpha(userMessage: string): Promise<AlphaResponse> {
    console.log(`🗣️ [Gemini Alpha] Processing: "${userMessage}"`)
    
    // Prompt được thiết kế để Alpha đóng vai trò trợ lý nhanh
    const prompt = `Bạn là Gemini Alpha, trợ lý AI chứng khoán. 
    Câu hỏi: "${userMessage}". 
    Trả lời ngắn gọn. Nếu người dùng hỏi sâu về một mã chứng khoán cụ thể, hãy đề xuất phân tích sâu.`

    const rawResponse = await this.callGeminiAPI(prompt, DEFAULT_GEMINI_MODEL)
    
    // Giả lập logic: Kiểm tra xem Alpha có gợi ý mã chứng khoán nào để gửi xuống HUB không
    // Trong thực tế, bạn sẽ dùng parser để tách mã CK từ rawResponse
    const detectedTicker = this.detectTickerFromText(userMessage) 
    
    // Nếu có ticker, Alpha gửi tín hiệu xuống HUB (Logic ẩn trong sơ đồ)
    if (detectedTicker) {
        console.log(`🔄 [Gemini Alpha] -> [HUB]: Detected Interest in ${detectedTicker}`)
    }

    return {
      text: rawResponse,
      relatedTicker: detectedTicker // Dữ liệu này sẽ được UI hoặc HUB sử dụng
    }
  }

  // --- Module: HUB (Router Logic) ---

  /**
   * HUB trung tâm (Hình thoi trong sơ đồ).
   * Nhận đầu vào từ /stock hoặc từ Alpha, quyết định gọi Deep Analysis.
   */
  async processInputHub(input: string, type: 'stock_code' | 'alpha_signal'): Promise<DeepAnalysisResult | string> {
    console.log(`💎 [HUB] Routing request. Type: ${type}, Input: ${input}`)

    if (type === 'stock_code') {
      // Luồng: User input HPG -> /stock -> HUB -> Deep Analysis
      return await this.analyzeDeeply(input)
    } 
    
    if (type === 'alpha_signal') {
      // Luồng: Alpha phát hiện mã -> HUB -> Deep Analysis (nếu được cấu hình tự động)
      return await this.analyzeDeeply(input)
    }

    return "HUB: Invalid input type"
  }

  // --- Module: Gemini Deep Analysis ---

  /**
   * Phân tích sâu (Deep Analysis).
   * Được gọi bởi HUB hoặc khi User click "Gemini phân tích HPG".
   */
  async analyzeDeeply(ticker: string): Promise<DeepAnalysisResult> {
    console.log(`🧠 [Gemini Deep Analysis] Analyzing: ${ticker}`)
    
    const prompt = `Thực hiện phân tích chuyên sâu (Deep Analysis) cho mã cổ phiếu: ${ticker}.
    Bao gồm: Xu hướng kỹ thuật, Định giá cơ bản, và Rủi ro tiềm ẩn.
    Trả về định dạng JSON.`

    // Deep Analysis gọi lại API Gemini AI (theo mũi tên đi lên trong sơ đồ)
    const rawData = await this.callGeminiAPI(prompt, DEFAULT_GEMINI_MODEL)
    
    // Parse kết quả
    return parseDeepAnalysisResponse(rawData)
  }

  // --- Utilities ---

  private detectTickerFromText(text: string): string | null {
    // Logic đơn giản để tìm mã CK (VD: 3 chữ cái in hoa)
    const match = text.match(/\b[A-Z]{3}\b/)
    return match ? match[0] : null
  }

  async healthCheck(): Promise<{ status: 'ok' | 'error', message: string }> {
    try {
      if (!this.isConfigured()) {
        return { status: 'error', message: 'API key not configured' }
      }
      await this.callGeminiAPI('Ping', DEFAULT_GEMINI_MODEL)
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
