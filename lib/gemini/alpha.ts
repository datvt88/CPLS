/**
 * Gemini Alpha - Chat AI Service
 *
 * Handles chat room interactions with AI assistant "Alpha"
 * Features:
 * - Stock market signal context
 * - Vietnamese stock market expertise
 * - Friendly chat personality
 * - Stock Hub integration for current stock context
 */

import { geminiHub } from './hub'
import type { AlphaResponse, DeepAnalysisResult } from './types'

// Stock context interface (matches StockHubContext output)
export interface StockContext {
  symbol: string
  prices?: Array<{
    date: string
    close: number
    change: number
    pctChange: number
    nmVolume: number
  }>
  technicalIndicators?: {
    ma10: number | null
    ma30: number | null
    bollinger: {
      upper: number
      middle: number
      lower: number
    } | null
    pivotPoints: {
      pivot: number
      S1: number
      S2: number
      R1: number
      R2: number
      R3: number
    } | null
    momentum5d: number | null
    momentum10d: number | null
  }
  ratios?: Record<string, { value: number }>
  recommendations?: Array<{
    type: string
    targetPrice: number
    firm?: string
  }>
  geminiAnalysis?: DeepAnalysisResult
}

// Alpha's personality prompt
const ALPHA_SYSTEM_PROMPT = `
Bạn tên là Alpha (ký hiệu 🤖).
Vai trò: Chuyên gia đầu tư chứng khoán Việt Nam và là Trợ lý ảo trong nhóm chat 'Kiếm tiền đi chợ'.
Tính cách: Thông minh, ngắn gọn, vui vẻ.

Quy tắc:
- Luôn tìm kiếm sâu tin tức chứng khoán Việt Nam mới nhất
- Sử dụng dữ liệu tín hiệu và dữ liệu cổ phiếu được cung cấp để tư vấn
- KHÔNG được suy diễn sai lệch
- Trả lời ngắn gọn, dễ hiểu
- Nếu có dữ liệu cổ phiếu đang xem, ưu tiên phân tích cổ phiếu đó
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
   * @param prompt User's question
   * @param signalsContext Golden Cross signals context string
   * @param stockContext Current stock being viewed context string
   */
  async ask(
    prompt: string,
    signalsContext?: string,
    stockContext?: string
  ): Promise<AlphaResponse> {
    try {
      if (!geminiHub.isConfigured()) {
        return { error: 'Server chưa cấu hình API Key.' }
      }

      // Build context sections
      let contextSections = ''

      // Stock context (from Stock Hub - current stock being viewed)
      if (stockContext) {
        contextSections += `
DỮ LIỆU CỔ PHIẾU ĐANG XEM TỪ STOCK HUB:
==================================================
${stockContext}
==================================================
`
      }

      // Signals context (Golden Cross signals)
      if (signalsContext) {
        contextSections += `
DỮ LIỆU TÍN HIỆU GOLDEN CROSS TỪ HỆ THỐNG:
-------------------------------------------------
${signalsContext}
-------------------------------------------------
`
      }

      const chatPrompt = `
${ALPHA_SYSTEM_PROMPT}

${contextSections}

Nhiệm vụ: Trả lời câu hỏi user. Nếu user hỏi về mã ngon/tín hiệu, hãy dùng dữ liệu trên để tư vấn.
Nếu có dữ liệu cổ phiếu đang xem, hãy ưu tiên phân tích cổ phiếu đó khi user hỏi.

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

  /**
   * Format stock context for Alpha AI
   * Used to convert Stock Hub data into a readable context string
   */
  formatStockContext(stockData: StockContext): string {
    if (!stockData || !stockData.symbol) {
      return ''
    }

    const lines: string[] = []
    lines.push(`📊 DỮ LIỆU CỔ PHIẾU ${stockData.symbol} ĐANG XEM:`)
    lines.push('=' .repeat(50))

    // Price data
    if (stockData.prices && stockData.prices.length > 0) {
      const latest = stockData.prices[stockData.prices.length - 1]
      lines.push(`\n📈 GIÁ HIỆN TẠI:`)
      lines.push(`- Giá đóng cửa: ${latest.close.toLocaleString('vi-VN')} VNĐ`)
      lines.push(`- Thay đổi: ${latest.change > 0 ? '+' : ''}${latest.change.toLocaleString('vi-VN')} (${latest.pctChange > 0 ? '+' : ''}${latest.pctChange.toFixed(2)}%)`)
      lines.push(`- Khối lượng: ${latest.nmVolume.toLocaleString('vi-VN')}`)
      lines.push(`- Ngày: ${new Date(latest.date).toLocaleDateString('vi-VN')}`)
    }

    // Technical indicators
    if (stockData.technicalIndicators) {
      const ti = stockData.technicalIndicators
      lines.push(`\n📊 CHỈ BÁO KỸ THUẬT:`)
      if (ti.ma10 !== null) lines.push(`- MA10: ${ti.ma10.toLocaleString('vi-VN')}`)
      if (ti.ma30 !== null) lines.push(`- MA30: ${ti.ma30.toLocaleString('vi-VN')}`)
      if (ti.bollinger) {
        lines.push(`- Bollinger Upper: ${ti.bollinger.upper.toLocaleString('vi-VN')}`)
        lines.push(`- Bollinger Lower: ${ti.bollinger.lower.toLocaleString('vi-VN')}`)
      }
      if (ti.pivotPoints) {
        lines.push(`- Buy T+ (S2): ${ti.pivotPoints.S2.toLocaleString('vi-VN')}`)
        lines.push(`- Sell T+ (R3): ${ti.pivotPoints.R3.toLocaleString('vi-VN')}`)
      }
      if (ti.momentum5d !== null) lines.push(`- Momentum 5D: ${ti.momentum5d > 0 ? '+' : ''}${ti.momentum5d.toFixed(2)}%`)
    }

    // Fundamental ratios
    if (stockData.ratios && Object.keys(stockData.ratios).length > 0) {
      lines.push(`\n💰 CHỈ SỐ CƠ BẢN:`)
      const pe = stockData.ratios['PRICE_TO_EARNINGS']?.value
      const pb = stockData.ratios['PRICE_TO_BOOK']?.value
      const roe = stockData.ratios['ROAE_TR_AVG5Q']?.value
      const marketCap = stockData.ratios['MARKETCAP']?.value

      if (pe) lines.push(`- P/E: ${pe.toFixed(2)}x`)
      if (pb) lines.push(`- P/B: ${pb.toFixed(2)}x`)
      if (roe) lines.push(`- ROE: ${(roe * 100).toFixed(2)}%`)
      if (marketCap) lines.push(`- Vốn hóa: ${(marketCap / 1e9).toFixed(2)} tỷ VNĐ`)
    }

    // Recommendations
    if (stockData.recommendations && stockData.recommendations.length > 0) {
      lines.push(`\n🎯 KHUYẾN NGHỊ ANALYST (${stockData.recommendations.length} công ty):`)
      const buyCount = stockData.recommendations.filter(r => r.type === 'BUY').length
      const holdCount = stockData.recommendations.filter(r => r.type === 'HOLD').length
      const sellCount = stockData.recommendations.filter(r => r.type === 'SELL').length
      lines.push(`- MUA: ${buyCount} | NẮM GIỮ: ${holdCount} | BÁN: ${sellCount}`)

      const avgTarget = stockData.recommendations.reduce((sum, r) => sum + (r.targetPrice || 0), 0) / stockData.recommendations.length
      if (avgTarget > 0) {
        lines.push(`- Giá mục tiêu TB: ${avgTarget.toLocaleString('vi-VN')} VNĐ`)
      }
    }

    // Gemini analysis if available
    if (stockData.geminiAnalysis) {
      lines.push(`\n🤖 PHÂN TÍCH GEMINI AI:`)
      lines.push(`- Ngắn hạn: ${stockData.geminiAnalysis.shortTerm.signal} (${stockData.geminiAnalysis.shortTerm.confidence}%)`)
      lines.push(`- Dài hạn: ${stockData.geminiAnalysis.longTerm.signal} (${stockData.geminiAnalysis.longTerm.confidence}%)`)
      if (stockData.geminiAnalysis.buyPrice) lines.push(`- Vùng mua: ${stockData.geminiAnalysis.buyPrice}`)
      if (stockData.geminiAnalysis.targetPrice) lines.push(`- Mục tiêu: ${stockData.geminiAnalysis.targetPrice}`)
      if (stockData.geminiAnalysis.stopLoss) lines.push(`- Cắt lỗ: ${stockData.geminiAnalysis.stopLoss}`)
    }

    lines.push('\n' + '=' .repeat(50))

    return lines.join('\n')
  }
}

// Export singleton instance
export const geminiAlpha = new GeminiAlpha()
