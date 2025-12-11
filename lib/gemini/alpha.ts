/**
 * Gemini Alpha - Chat AI Service
 *
 * Handles chat room interactions with AI assistant "Alpha"
 * Features:
 * - Stock market signal context
 * - Vietnamese stock market expertise
 * - Friendly chat personality
 */

import { geminiHub } from './hub'
import type { AlphaResponse } from './types'

// Alpha's personality prompt
const ALPHA_SYSTEM_PROMPT = `
Bạn tên là Alpha (ký hiệu 🤖).
Vai trò: Chuyên gia đầu tư chứng khoán Việt Nam và là Trợ lý ảo trong nhóm chat 'Kiếm tiền đi chợ'.
Tính cách: Thông minh, ngắn gọn, vui vẻ.

Quy tắc:
- Luôn tìm kiếm sâu tin tức chứng khoán Việt Nam mới nhất
- Sử dụng dữ liệu tín hiệu được cung cấp để tư vấn
- KHÔNG được suy diễn sai lệch
- Trả lời ngắn gọn, dễ hiểu
`

/**
 * Gemini Alpha Service
 */
class GeminiAlpha {
  /**
   * Check connection to Gemini API
   */
  async checkConnection(): Promise<boolean> {
    try {
      if (!geminiHub.isConfigured()) return false

      const health = await geminiHub.healthCheck()
      return health.status === 'ok'
    } catch (error) {
      console.error('Gemini Alpha Connection Error:', error)
      return false
    }
  }

  /**
   * Ask Alpha a question with optional market context
   */
  async ask(prompt: string, signalsContext?: string): Promise<AlphaResponse> {
    try {
      if (!geminiHub.isConfigured()) {
        return { error: 'Server chưa cấu hình API Key.' }
      }

      const contextSection = signalsContext
        ? `
DỮ LIỆU TÍN HIỆU THỊ TRƯỜNG MỚI NHẤT TỪ HỆ THỐNG:
-------------------------------------------------
${signalsContext}
-------------------------------------------------
`
        : ''

      const chatPrompt = `
${ALPHA_SYSTEM_PROMPT}

${contextSection}

Nhiệm vụ: Trả lời câu hỏi user. Nếu user hỏi về mã ngon/tín hiệu, hãy dùng dữ liệu trên để tư vấn.

Câu hỏi: "${prompt}"
`

      const text = await geminiHub.callGeminiAPI(chatPrompt, 'gemini-2.5-flash-lite')
      return { text }
    } catch (error: any) {
      console.error('Gemini Alpha Error:', error)
      return { error: 'Alpha đang gặp sự cố kết nối.' }
    }
  }

  /**
   * Format signals for context
   */
  formatSignalsContext(signals: Array<{
    ticker: string
    price?: number
    ma30?: number
    timeCross: Date | string
  }>): string {
    if (!signals || signals.length === 0) {
      return 'Hệ thống báo: Không có tín hiệu Golden Cross nào gần đây.'
    }

    return signals.map(s =>
      `- Mã: ${s.ticker} | Giá: ${s.price?.toLocaleString()} | MA30: ${s.ma30?.toLocaleString()} | Ngày: ${new Date(s.timeCross).toLocaleDateString('vi-VN')}`
    ).join('\n')
  }
}

// Export singleton instance
export const geminiAlpha = new GeminiAlpha()
