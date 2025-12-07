// File: app/chat/chat-gemini.ts
'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"
import { fetchGoldenCrossSignals } from '@/services/signal.service' // Import hàm lấy dữ liệu

// 1. Hàm kiểm tra kết nối
export async function checkConnection() {
  if (!process.env.GEMINI_API_KEY) return false
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    await model.generateContent("hi") 
    return true
  } catch (error) {
    console.error("Gemini Connection Error:", error)
    return false
  }
}

// 2. Hàm chat chính (Đã nâng cấp đọc dữ liệu)
export async function askGemini(prompt: string) {
  try {
    if (!process.env.GEMINI_API_KEY) return { error: 'Server chưa cấu hình API Key.' }

    // --- BƯỚC 1: Lấy dữ liệu tín hiệu mới nhất từ Firebase ---
    const signals = await fetchGoldenCrossSignals()

    // --- BƯỚC 2: Chuyển dữ liệu thành dạng văn bản để Bot đọc ---
    // Format: [Mã] Giá: ... | MA30: ... | Ngày: ...
    const signalsContext = signals.length > 0 
      ? signals.map(s => 
          `- Mã: ${s.ticker} | Giá hiện tại: ${s.price?.toLocaleString()} | Vùng mua (MA30): ${s.ma30?.toLocaleString()} | Thời gian tín hiệu: ${new Date(s.timeCross).toLocaleDateString('vi-VN')}`
        ).join('\n')
      : "Hiện tại hệ thống chưa ghi nhận tín hiệu Golden Cross nào mới."

    // --- BƯỚC 3: Cấu hình Gemini ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }) 
    
    // --- BƯỚC 4: Tạo Prompt kèm dữ liệu (Context Injection) ---
    const chatPrompt = `
    Bạn là Alpha (ký hiệu 🤖) - Chuyên gia phân tích thị trường chứng khoán Việt Nam và trợ lý ảo trong room chat.
    Tính cách: Thông minh, ngắn gọn, vui vẻ, đôi khi dùng thuật ngữ "bắt đáy", "đu đỉnh", "về bờ" cho gần gũi.

    Dưới đây là DỮ LIỆU TÍN HIỆU KỸ THUẬT (GOLDEN CROSS) MỚI NHẤT từ hệ thống của chúng ta:
    =========================================
    ${signalsContext}
    =========================================

    Yêu cầu khi trả lời:
    1. Trả lời câu hỏi của user: "${prompt}"
    2. Nếu user hỏi "có mã nào ngon", "mua gì", "tín hiệu mới", HÃY DÙNG DỮ LIỆU TRÊN để trả lời.
    3. Nếu user hỏi về một mã CÓ trong danh sách trên, hãy cung cấp chi tiết giá và ngày tín hiệu.
    4. Nếu user hỏi về một mã KHÔNG có trong danh sách, hãy nói bạn không thấy tín hiệu Golden Cross của mã đó gần đây, nhưng có thể chém gió chung về thị trường.
    5. Luôn nhắc nhở quản trị rủi ro.

    Trả lời ngắn gọn:
    `

    const result = await model.generateContent(chatPrompt)
    const response = await result.response
    const text = response.text()
    
    return { text }
  } catch (error: any) {
    console.error('Gemini Error:', error)
    return { error: 'Alpha đang mải soi bảng điện nên mất kết nối, thử lại sau nhé!' }
  }
}
