/**
 * Gemini Hub - Central Coordinator & Router for StockHub
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DeepAnalysisResult } from "./types"; // Đảm bảo import đúng type

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-2.5-flash";

const GENERATION_CONFIG = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
};

// --- Interfaces ---
export interface AlphaResponse {
  text: string;
  relatedTicker?: string | null;
}

export interface DeepAnalysisContext {
  symbol: string;
  technicalData: any;
  fundamentalData: any;
  recommendations: any[];
}

// --- UTILITIES (Exported to fix the error) ---

/**
 * Hàm parse phản hồi từ Gemini (Xử lý chuỗi JSON có thể bị bao bởi markdown code block)
 */
export function parseDeepAnalysisResponse(text: string): DeepAnalysisResult {
  try {
    // Loại bỏ markdown code block (```json ... ```) nếu có
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON from Gemini:", text);
    throw new Error("Invalid JSON response from AI");
  }
}

/**
 * GeminiHub: Singleton Class quản lý luồng dữ liệu AI
 */
class GeminiHub {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    if (!API_KEY) {
      console.error("❌ GeminiHub: API Key is missing!");
      throw new Error("Gemini API key not configured");
    }
    this.genAI = new GoogleGenerativeAI(API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: DEFAULT_MODEL, 
      generationConfig: GENERATION_CONFIG 
    });
  }

  /**
   * ROUTER: Hàm trung tâm xử lý đầu vào từ Hub
   */
  async processInputHub(input: string | DeepAnalysisContext, type: 'simple_ticker' | 'full_context') {
    console.log(`💎 [HUB] Routing request. Type: ${type}`);

    if (type === 'full_context') {
      return await this.analyzeDeeplyWithContext(input as DeepAnalysisContext);
    } 
    
    if (type === 'simple_ticker') {
      return await this.analyzeDeeplySimple(input as string);
    }

    throw new Error("HUB: Invalid input type");
  }

  // --- Module: Gemini Alpha (Chat & Quick Signal) ---

  async chatWithAlpha(userMessage: string): Promise<AlphaResponse> {
    console.log(`🗣️ [Gemini Alpha] Processing: "${userMessage}"`);
    
    const prompt = `Bạn là Gemini Alpha, trợ lý chứng khoán thông minh trên StockHub.
    User hỏi: "${userMessage}".
    Trả lời ngắn gọn, vui vẻ. Nếu phát hiện mã chứng khoán (3 chữ cái in hoa), hãy nhắc đến nó để hệ thống Hub nhận diện.`;

    const result = await this.model.generateContent(prompt);
    const responseText = result.response.text();
    const detectedTicker = this.detectTickerFromText(userMessage) || this.detectTickerFromText(responseText);

    if (detectedTicker) {
        console.log(`🔄 [Gemini Alpha] -> [HUB]: Detected Interest in ${detectedTicker}`);
    }

    return {
      text: responseText,
      relatedTicker: detectedTicker
    };
  }

  // --- Module: Gemini Deep Analysis ---

  private async analyzeDeeplyWithContext(ctx: DeepAnalysisContext) {
    console.log(`🧠 [Gemini Deep Analysis] Analyzing Context for: ${ctx.symbol}`);

    const prompt = `
    Đóng vai trò là chuyên gia phân tích tài chính cấp cao (CFA) trên nền tảng StockHub.
    Hãy phân tích mã cổ phiếu ${ctx.symbol} dựa trên dữ liệu thực tế sau (Tuyệt đối không bịa đặt số liệu):

    1. DỮ LIỆU KỸ THUẬT (Technical):
    - Giá hiện tại: ${ctx.technicalData.currentPrice}
    - Điểm mua Pivot (S2): ${ctx.technicalData.buyPrice || 'N/A'}
    - Tín hiệu MA: ${ctx.technicalData.maSignal}
    - Bollinger Bands: ${JSON.stringify(ctx.technicalData.bollinger)}
    - Momentum (5d/10d): ${JSON.stringify(ctx.technicalData.momentum)}
    - Khối lượng: ${JSON.stringify(ctx.technicalData.volume)}

    2. DỮ LIỆU CƠ BẢN (Fundamental):
    - P/E: ${ctx.fundamentalData.pe}, P/B: ${ctx.fundamentalData.pb}
    - ROE: ${ctx.fundamentalData.roe}%, ROA: ${ctx.fundamentalData.roa}%
    - Sức khỏe tài chính: ${JSON.stringify(ctx.fundamentalData.profitability?.data || 'N/A')}

    3. KHUYẾN NGHỊ TỪ CTCK KHÁC:
    ${JSON.stringify(ctx.recommendations)}

    YÊU CẦU OUTPUT (Định dạng JSON chuẩn):
    {
      "shortTerm": {
        "signal": "MUA" | "BÁN" | "NẮM GIỮ",
        "confidence": number (0-100),
        "summary": "Nhận định ngắn gọn về kỹ thuật...",
        "reasons": ["Lý do 1", "Lý do 2"]
      },
      "longTerm": {
        "signal": "MUA" | "BÁN" | "NẮM GIỮ",
        "confidence": number (0-100),
        "summary": "Nhận định về định giá và tăng trưởng...",
        "reasons": ["Lý do 1", "Lý do 2"]
      },
      "buyPrice": number | null,
      "targetPrice": number | null,
      "stopLoss": number | null,
      "risks": ["Rủi ro 1", "Rủi ro 2"],
      "opportunities": ["Cơ hội 1", "Cơ hội 2"]
    }
    Chỉ trả về JSON.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      // Sử dụng hàm đã export
      const parsed = parseDeepAnalysisResponse(text);
      
      // Gán thêm timestamp
      return { ...parsed, timestamp: Date.now() };
    } catch (error) {
      console.error("Deep Analysis Error:", error);
      throw error;
    }
  }

  private async analyzeDeeplySimple(ticker: string) {
    const prompt = `Phân tích nhanh mã cổ phiếu ${ticker}. Trả về định dạng JSON (cấu trúc tương tự như full analysis nhưng đánh dấu là dữ liệu ước tính).`;
    const result = await this.model.generateContent(prompt);
    return parseDeepAnalysisResponse(result.response.text());
  }

  private detectTickerFromText(text: string): string | null {
    const match = text.match(/\b[A-Z]{3}\b/);
    return match ? match[0] : null;
  }
}

// Export singleton instance
export const geminiHub = new GeminiHub();
