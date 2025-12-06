// File: app/chat/chat-gemini.ts
'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"

export async function askGemini(prompt: string) {
  // 1. Kiểm tra Key (Lấy từ Vercel Environment Variables)
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    console.error("❌ Lỗi: Chưa tìm thấy GEMINI_API_KEY trong biến môi trường.")
    return { error: 'Server chưa cấu hình API Key. Hãy kiểm tra cài đặt Vercel.' }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    
    // 2. Tạo tính cách cho Alpha
    const chatPrompt = `Bạn tên là Alpha (ký hiệu 🤖). 
    Vai trò: Chuyên gia đầu tư chứng khoán Việt Nam. Trợ lý ảo trong nhóm chat.
    Tính cách: Thông minh, ngắn gọn, hài hước và rất "tỉnh".
    Nhiệm vụ: Trả lời câu hỏi của người dùng một cách ngắn gọn và tự nhiên nhất.
    
    Câu hỏi: "${prompt}"
    
    Trả lời:`

    // 3. Gọi Google AI
    const result = await model.generateContent(chatPrompt)
    const response = await result.response
    const text = response.text()
    
    return { text }

  } catch (error: any) {
    console.error('🔥 Gemini API Error:', error)
    return { error: 'Alpha đang bị quá tải, thử lại sau nhé!' }
  }
}
