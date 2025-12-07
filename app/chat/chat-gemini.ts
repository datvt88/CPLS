// File: app/chat/chat-gemini.ts
'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"
// Import hàm lấy dữ liệu chúng ta vừa tạo ở Bước 1
import { fetchGoldenCrossSignals } from '@/services/signal.service'

// 1. Hàm kiểm tra kết nối
export async function checkConnection() {
  if (!process.env.GEMINI_API_KEY) return false
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    // Lưu ý: Nếu gemini-2.0-flash chưa ổn định, hãy đổi về gemini-1.5-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
    await model.generateContent("hi") 
    return true
  } catch (error) {
    console.error("Gemini Connection Error:", error)
    return false
  }
}

// 2. Hàm chat chính (Đã tối ưu)
export async function askGemini(prompt: string) {
  try {
    if (!process.env.GEMINI_API_KEY) return { error: 'Server chưa cấu hình API Key.' }

    // --- BƯỚC 1: Lấy dữ liệu thị trường (Có xử lý lỗi riêng) ---
    let signalsContext = "Hiện tại chưa lấy được dữ liệu tín hiệu.";
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
        console.error("Lỗi đọc dữ liệu cho Bot:", err)
        // Bot vẫn hoạt động tiếp dù không đọc được dữ liệu
    }

    // --- BƯỚC 2: Gọi Gemini ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }) 
    
    const chatPrompt = `
    Bạn là Alpha (ký hiệu 🤖) - Chuyên gia phân tích chứng chứng khoán Việt Nam và trợ lý ảo. Tính cách: Thông minh, ngắn gọn, vui vẻ, đôi khi dùng thuật ngữ "bắt đáy", "đu đỉnh", "về bờ" cho gần gũi.
    
    DỮ LIỆU TÍN HIỆU GOLDEN CROSS THỰC TẾ TỪ HỆ THỐNG:
    --------------------------------------------------
    ${signalsContext}
    --------------------------------------------------

    Yêu cầu trả lời:
    1. Câu hỏi của user: "${prompt}"
    2. Nếu user hỏi mua mã nào, có mã nào ngon: Hãy phân tích dựa trên danh sách trên.
    3. Nếu user hỏi mã cụ thể: Kiểm tra xem mã đó có trong danh sách không. Nếu có thì báo giá và ngày tín hiệu. Nếu không, hãy nói bạn không thấy tín hiệu Golden Cross của mã đó.
    4. Phong cách: Ngắn gọn, chuyên nghiệp nhưng thân thiện. Luôn nhắc quản trị rủi ro.
    `

    const result = await model.generateContent(chatPrompt)
    const response = await result.response
    const text = response.text()
    
    return { text }
  } catch (error: any) {
    console.error('Gemini Error:', error)
    return { error: 'Alpha đang gặp sự cố kết nối AI.' }
  }
}
