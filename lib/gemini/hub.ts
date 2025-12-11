/**
 * Gemini Hub - Central Coordinator & Router for StockHub
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DeepAnalysisResult } from "./types";

// --- Configuration ---
const DEFAULT_MODEL = "gemini-1.5-flash";

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

// --- UTILITIES (Exported) ---

/**
 * Hàm parse phản hồi từ Gemini
 */
export function parseDeepAnalysisResponse(text: string): DeepAnalysisResult {
  try {
    // Loại bỏ markdown code block nếu có
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
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: DEFAULT_MODEL, 
        generationConfig: GENERATION_CONFIG 
      });
    } else {
      console.warn("⚠️ GeminiHub: API Key is missing. AI features will be disabled.");
    }
  }

  /**
   * Kiểm tra xem API Key đã được cấu hình chưa (Sửa lỗi build của bạn)
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.model;
  }

  /**
   * Kiểm tra kết nối thực tế tới Google (Health Check)
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error', message: string }> {
    if (!this.isConfigured()) {
      return { status: 'error', message: 'API key not configured' };
    }
    try {
      // Gửi prompt test siêu ngắn
      await this.model.generateContent("Ping");
      return { status: 'ok', message: 'Gemini API is connected' };
    } catch (error: any) {
      return { status: 'error', message: error.message || 'Connection failed' };
    }
  }

  /**
   * ROUTER: Hàm trung tâm xử lý đầu vào từ Hub
   */
  async processInputHub(input: string | DeepAnalysisContext, type: 'simple_ticker' | 'full_context') {
    if (!this.isConfigured()) throw new Error("Gemini API Key is missing");

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
    if (!this.isConfigured()) return { text: "Hệ thống AI chưa được cấu hình.", relatedTicker: null };

    const prompt = `Bạn là Gemini Alpha, trợ lý chứng khoán thông minh trên StockHub.
    User hỏi: "${userMessage}".
    Trả lời ngắn gọn, vui vẻ. Nếu phát hiện mã chứng khoán (3 chữ cái in hoa), hãy nhắc đến nó.`;

    const result = await this.model.generateContent(prompt);
    const responseText = result.response.text();
    const detectedTicker = this.detectTickerFromText(userMessage) || this.detectTickerFromText(responseText);

    return {
      text: responseText,
      relatedTicker: detectedTicker
    };
  }

  // --- Module: Gemini Deep Analysis ---

  private async analyzeDeeplyWithContext(ctx: DeepAnalysisContext) {
    if (!this.model) throw new Error("Model not initialized");
    console.log(`🧠 [Gemini Deep Analysis] Analyzing Context for: ${ctx.symbol}`);

    const prompt = `
    Đóng vai trò chuyên gia CFA. Phân tích cổ phiếu ${ctx.symbol} dựa trên dữ liệu thật:
    
    TECHNICAL:
    - Price: ${ctx.technicalData.currentPrice}
    - MA Signal: ${ctx.technicalData.maSignal}
    - Pivot S2 (Buy Zone): ${ctx.technicalData.buyPrice || 'N/A'}
    - Bollinger: ${JSON.stringify(ctx.technicalData.bollinger)}
    - Momentum: ${JSON.stringify(ctx.technicalData.momentum)}
    
    FUNDAMENTAL:
    - P/E: ${ctx.fundamentalData.pe}, P/B: ${ctx.fundamentalData.pb}
    - ROE: ${ctx.fundamentalData.roe}%, Profitability: ${JSON.stringify(ctx.fundamentalData.profitability?.data || 'N/A')}
    
    RECOMMENDATIONS: ${JSON.stringify(ctx.recommendations)}

    OUTPUT JSON ONLY (No Markdown):
    {
      "shortTerm": { "signal": "MUA"|"BÁN"|"NẮM GIỮ", "confidence": 0-100, "summary": "...", "reasons": ["..."] },
      "longTerm": { "signal": "MUA"|"BÁN"|"NẮM GIỮ", "confidence": 0-100, "summary": "...", "reasons": ["..."] },
      "buyPrice": number|null, "targetPrice": number|null, "stopLoss": number|null,
      "risks": ["..."], "opportunities": ["..."]
    }
    `;

    const result = await this.model.generateContent(prompt);
    const parsed = parseDeepAnalysisResponse(result.response.text());
    return { ...parsed, timestamp: Date.now() };
  }

  private async analyzeDeeplySimple(ticker: string) {
    if (!this.model) throw new Error("Model not initialized");
    const prompt = `Phân tích nhanh mã ${ticker}. Trả về JSON cấu trúc chuẩn StockHub.`;
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
