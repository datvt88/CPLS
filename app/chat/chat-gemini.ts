// File: app/chat/chat-gemini.ts
'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"
// Lưu ý: Kiểm tra kỹ tên file của bạn là 'signal.service' hay 'signals.service' nhé
import { fetchGoldenCrossSignals } from '@/services/signal.service'

// 1. Hàm kiểm tra kết nối
export async function checkConnection() {
  if (!process.env.GEMINI_API_KEY) return false
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    await model.generateContent("hi") 
    return true
  } catch (error) {
    console.error("Gemini Connection Error:", error)
    return false
  }
}

// 2. Hàm chat chính
export async function askGemini(prompt: string) {
  try {
    if (!process.env.GEMINI_API_KEY) return { error: 'Server chưa cấu hình API Key.' }

    // --- BƯỚC 1: Lấy dữ liệu thị trường ---
    let signalsContext = "Hiện tại chưa lấy được dữ liệu tín hiệu.";
    
    // SỬA LỖI 1: Thêm đóng ngoặc và catch cho khối try này
    try {
        const signals = await fetchGoldenCrossSignals()
        if (signals.length > 0) {
            signalsContext = signals.map(s => 
                `- Mã: ${s.ticker} | Giá: ${s.price?.toLocaleString()} | MA30: ${s.ma30?.toLocaleString()} | Ngày: ${new Date(s.timeCross).toLocaleDateString('vi-VN')}`
            ).join('\n')
        } else {
            signalsContext = "Hệ thống báo: Không có tín hiệu Golden Cross nào gần đây.";
        }
    } catch (err) {
        console.error("Lỗi đọc dữ liệu signals:", err)
        // Nếu lỗi database, bot vẫn hoạt động nhưng không có dữ liệu
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }) 

    // SỬA LỖI 2: Đưa biến signalsContext vào trong Prompt để Bot đọc được
    const chatPrompt = `
    Bạn tên là Alpha (ký hiệu 🤖). 
    Vai trò: Chuyên gia đầu tư chứng khoán Việt Nam và là Trợ lý ảo trong nhóm chat.
    Tính cách: Thông minh, ngắn gọn, vui vẻ.

    DỮ LIỆU TÍN HIỆU THỊ TRƯỜNG MỚI NHẤT TỪ HỆ THỐNG:
    -------------------------------------------------
    ${signalsContext}
    -------------------------------------------------

    Nhiệm vụ: Trả lời câu hỏi user. Nếu user hỏi về mã ngon/tín hiệu, hãy dùng dữ liệu trên để tư vấn.
    
    Câu hỏi: "${prompt}"
    `

    const result = await model.generateContent(chatPrompt)
    const response = await result.response
    const text = response.text()
    
    return { text }

  } catch (error: any) {
    console.error('Gemini Error:', error)
    return { error: 'Alpha đang gặp sự cố kết nối.' }
  }
}
