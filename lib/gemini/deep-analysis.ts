/**
 * Gemini Deep Analysis - Stock Analysis Service
 *
 * Provides comprehensive stock analysis combining:
 * - Technical Analysis (70% short-term)
 * - Fundamental Analysis (70% long-term)
 * - AI-powered insights
 */

import { geminiAPI } from './gemini-api'
import { parseDeepAnalysisResponse } from './parser'
import type { DeepAnalysisRequest, DeepAnalysisResult } from './types'

/**
 * Gemini Deep Analysis Service
 */
class GeminiDeepAnalysis {
  /**
   * Analyze a stock with comprehensive data
   */
  async analyze(request: DeepAnalysisRequest): Promise<DeepAnalysisResult & { rawText?: string }> {
    const { symbol, technicalData, fundamentalData, recommendations, model } = request

    if (!geminiAPI.isConfigured()) {
      throw new Error('Gemini API key not configured')
    }

    console.log('📊 GeminiDeepAnalysis: Analyzing stock:', symbol)

    const prompt = this.buildPrompt(symbol, technicalData, fundamentalData, recommendations)
    const rawText = await geminiAPI.callAPI(prompt, model)

    console.log('📝 GeminiDeepAnalysis: Raw response length:', rawText.length)

    const result = parseDeepAnalysisResponse(rawText, technicalData?.currentPrice)

    console.log('✅ GeminiDeepAnalysis: Analysis completed for', symbol, {
      shortTerm: result.shortTerm?.signal,
      longTerm: result.longTerm?.signal,
    })

    return { ...result, rawText }
  }

  /**
   * Build comprehensive analysis prompt
   */
  private buildPrompt(
    symbol: string,
    technicalData?: DeepAnalysisRequest['technicalData'],
    fundamentalData?: DeepAnalysisRequest['fundamentalData'],
    recommendations?: DeepAnalysisRequest['recommendations']
  ): string {
    let prompt = `Bạn là chuyên gia phân tích chứng khoán Việt Nam. Hãy phân tích chuyên sâu cổ phiếu ${symbol} dựa trên dữ liệu sau:\n\n`

    // Technical Analysis Section
    if (technicalData) {
      prompt += `📊 DỮ LIỆU KỸ THUẬT:\n`
      prompt += `Giá hiện tại: ${technicalData.currentPrice?.toFixed(2)} (x1000 VNĐ)\n`

      if (technicalData.ma10 && technicalData.ma30) {
        const maDiff = ((technicalData.ma10 - technicalData.ma30) / technicalData.ma30 * 100).toFixed(2)
        const maSignal = technicalData.ma10 > technicalData.ma30 ? 'TĂNG' : 'GIẢM'
        prompt += `MA10: ${technicalData.ma10.toFixed(2)} | MA30: ${technicalData.ma30.toFixed(2)} | Chênh lệch: ${maDiff}% | Xu hướng: ${maSignal}\n`
      }

      if (technicalData.bollinger) {
        const bandPosition = ((technicalData.currentPrice! - technicalData.bollinger.lower) /
                             (technicalData.bollinger.upper - technicalData.bollinger.lower) * 100).toFixed(1)
        prompt += `Bollinger: Upper=${technicalData.bollinger.upper.toFixed(2)}, Middle=${technicalData.bollinger.middle.toFixed(2)}, Lower=${technicalData.bollinger.lower.toFixed(2)}\n`
        prompt += `Vị trí trong Bollinger: ${bandPosition}%\n`
      }

      if (technicalData.momentum) {
        prompt += `Momentum 5 ngày: ${technicalData.momentum.day5?.toFixed(2)}% | 10 ngày: ${technicalData.momentum.day10?.toFixed(2)}%\n`
      }

      if (technicalData.volume) {
        prompt += `Khối lượng: ${technicalData.volume.current?.toLocaleString()} | TB 10 ngày: ${technicalData.volume.avg10?.toLocaleString()} | Tỷ lệ: ${technicalData.volume.ratio?.toFixed(0)}%\n`
      }

      if (technicalData.week52) {
        const position = ((technicalData.currentPrice! - technicalData.week52.low) /
                         (technicalData.week52.high - technicalData.week52.low) * 100).toFixed(0)
        prompt += `52 tuần: ${technicalData.week52.low?.toFixed(2)} - ${technicalData.week52.high?.toFixed(2)} | Vị trí: ${position}%\n`
      }

      if (technicalData.buyPrice) {
        prompt += `Hỗ trợ kỹ thuật (S2): ${technicalData.buyPrice.toFixed(2)}\n`
      }

      prompt += `\n`
    }

    // Fundamental Analysis Section
    if (fundamentalData) {
      prompt += `💰 DỮ LIỆU CƠ BẢN:\n`

      if (fundamentalData.pe !== undefined) {
        prompt += `P/E: ${fundamentalData.pe.toFixed(2)}\n`
      }

      if (fundamentalData.pb !== undefined) {
        prompt += `P/B: ${fundamentalData.pb.toFixed(2)}\n`
      }

      if (fundamentalData.roe !== undefined) {
        prompt += `ROE: ${(fundamentalData.roe * 100).toFixed(2)}%\n`
      }

      if (fundamentalData.roa !== undefined) {
        prompt += `ROA: ${(fundamentalData.roa * 100).toFixed(2)}%\n`
      }

      if (fundamentalData.dividendYield !== undefined) {
        prompt += `Cổ tức: ${(fundamentalData.dividendYield * 100).toFixed(2)}%\n`
      }

      if (fundamentalData.marketCap !== undefined) {
        prompt += `Vốn hóa: ${(fundamentalData.marketCap / 1000000000000).toFixed(2)} nghìn tỷ\n`
      }

      if (fundamentalData.eps !== undefined) {
        prompt += `EPS: ${fundamentalData.eps.toFixed(2)}\n`
      }

      // Add detailed profitability data if available
      if (fundamentalData.profitability?.metrics?.length) {
        prompt += `\n📈 HIỆU QUẢ HOẠT ĐỘNG (5 QUÝ):\n`

        const { quarters, metrics } = fundamentalData.profitability
        metrics.forEach((metric) => {
          if (metric.label && metric.y?.length > 0) {
            prompt += `${metric.label}: `
            const reversedQuarters = [...quarters].reverse()
            const reversedValues = [...metric.y].reverse()
            reversedQuarters.forEach((q, i) => {
              prompt += `${q}: ${reversedValues[i].toFixed(2)}%${i < reversedQuarters.length - 1 ? ', ' : ''}`
            })

            const latest = metric.y[metric.y.length - 1]
            const oldest = metric.y[0]
            const trend = latest - oldest
            prompt += trend > 0 ? ` (tăng ${trend.toFixed(2)}%)\n` : trend < 0 ? ` (giảm ${Math.abs(trend).toFixed(2)}%)\n` : ` (ổn định)\n`
          }
        })
      }

      prompt += `\n`
    }

    // Analyst Recommendations Section
    if (recommendations?.length) {
      prompt += `📋 KHUYẾN NGHỊ CTCK:\n`

      const buyRecs = recommendations.filter(r => r.type?.toUpperCase() === 'BUY' || r.type?.toUpperCase() === 'MUA')
      const holdRecs = recommendations.filter(r => r.type?.toUpperCase() === 'HOLD' || r.type?.toUpperCase() === 'GIỮ')
      const sellRecs = recommendations.filter(r => r.type?.toUpperCase() === 'SELL' || r.type?.toUpperCase() === 'BÁN')

      prompt += `Tổng: ${recommendations.length} (MUA: ${buyRecs.length}, GIỮ: ${holdRecs.length}, BÁN: ${sellRecs.length})\n`

      const recsWithTarget = recommendations.filter(r => r.targetPrice && !isNaN(r.targetPrice))
      if (recsWithTarget.length > 0) {
        const avgTarget = recsWithTarget.reduce((sum, r) => sum + r.targetPrice!, 0) / recsWithTarget.length
        prompt += `Giá mục tiêu TB: ${avgTarget.toFixed(2)}\n`
      }

      prompt += `\n`
    }

    // Analysis Instructions
    prompt += `🎯 YÊU CẦU PHÂN TÍCH:\n\n`
    prompt += `QUAN TRỌNG: Hãy phân tích DỰA TRÊN DỮ LIỆU THỰC TẾ được cung cấp ở trên. Đưa ra nhận định CỤ THỂ, KHÔNG được trả lời chung chung.\n\n`
    prompt += `1. NGẮN HẠN (1-4 tuần): Tỷ trọng 70% KỸ THUẬT + 30% CƠ BẢN\n`
    prompt += `   - Phân tích cụ thể: MA crossover (MA10 vs MA30), vị trí Bollinger, momentum, khối lượng\n`
    prompt += `   - Nếu MA10 > MA30 và momentum > 0: thiên về MUA\n`
    prompt += `   - Nếu MA10 < MA30 và momentum < 0: thiên về BÁN\n\n`
    prompt += `2. DÀI HẠN (3-12 tháng): Tỷ trọng 70% CƠ BẢN + 30% KỸ THUẬT\n`
    prompt += `   - Phân tích cụ thể: P/E so với ngành, ROE, tăng trưởng\n`
    prompt += `   - Nếu P/E < 15 và ROE > 15%: thiên về MUA\n`
    prompt += `   - Nếu P/E > 25 và ROE < 10%: thiên về BÁN\n\n`
    prompt += `3. Khuyến nghị: MUA (confidence >= 65), BÁN (confidence >= 65), hoặc THEO DÕI\n\n`
    prompt += `4. LUÔN LUÔN cung cấp mức giá (dựa trên dữ liệu kỹ thuật):\n`
    prompt += `   - buyPrice: Giá mua tốt = Hỗ trợ S2 hoặc Bollinger Lower\n`
    prompt += `   - targetPrice: Giá mục tiêu = Kháng cự R2 hoặc giá mục tiêu CTCK\n`
    prompt += `   - stopLoss: Mức cắt lỗ = 5-7% dưới giá mua hoặc dưới hỗ trợ S3\n\n`
    prompt += `5. Đưa ra ĐÚNG 3 rủi ro và ĐÚNG 3 cơ hội CỤ THỂ cho cổ phiếu ${symbol} (không chung chung)\n\n`

    // Response format
    prompt += `📋 FORMAT JSON (BẮT BUỘC - chỉ trả về JSON, không có text khác):\n`
    prompt += `{
  "shortTerm": {
    "signal": "MUA",
    "confidence": 75,
    "summary": "MA10 (xxx) đã cắt lên MA30 (xxx) cho tín hiệu tích cực. Giá đang ở vị trí xx% trong dải Bollinger, momentum 5 ngày đạt +x.x%. Khối lượng giao dịch tăng xx% so với trung bình cho thấy dòng tiền đang vào. Vị trí xx% trong kênh 52 tuần cho thấy còn dư địa tăng."
  },
  "longTerm": {
    "signal": "MUA",
    "confidence": 70,
    "summary": "P/E hiện tại xx.x thấp hơn trung bình ngành (15-18). ROE đạt xx% cho thấy hiệu quả sử dụng vốn tốt. EPS tăng trưởng ổn định qua các quý gần đây. Các CTCK đưa giá mục tiêu trung bình xx.x, cao hơn giá hiện tại xx%."
  },
  "buyPrice": 85.5,
  "targetPrice": 95,
  "stopLoss": 80,
  "risks": ["Rủi ro cụ thể 1 cho ${symbol}", "Rủi ro cụ thể 2 cho ${symbol}", "Rủi ro cụ thể 3 cho ${symbol}"],
  "opportunities": ["Cơ hội cụ thể 1 cho ${symbol}", "Cơ hội cụ thể 2 cho ${symbol}", "Cơ hội cụ thể 3 cho ${symbol}"]
}\n\n`

    prompt += `LƯU Ý QUAN TRỌNG:\n`
    prompt += `- signal: "MUA", "BÁN", hoặc "THEO DÕI"\n`
    prompt += `- confidence: số nguyên 0-100 (MUA/BÁN cần >= 65)\n`
    prompt += `- buyPrice, targetPrice, stopLoss: LUÔN cung cấp số (x1000 VNĐ) dựa trên hỗ trợ/kháng cự\n`
    prompt += `- summary NGẮN HẠN: PHẢI 3-5 câu, đề cập CỤ THỂ: MA10/MA30, Bollinger %, momentum %, volume %, vị trí 52 tuần\n`
    prompt += `- summary DÀI HẠN: PHẢI 3-5 câu, đề cập CỤ THỂ: P/E, P/B, ROE %, ROA %, EPS, khuyến nghị CTCK\n`
    prompt += `- risks và opportunities: ĐÚNG 3 phần tử, CỤ THỂ cho ${symbol}, liên quan đến ngành/công ty, KHÔNG chung chung\n`

    return prompt
  }
}

// Export singleton instance
export const geminiDeepAnalysis = new GeminiDeepAnalysis()
