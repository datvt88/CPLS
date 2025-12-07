// File: app/chat/chat-gemini.ts

'use server'



import { GoogleGenerativeAI } from "@google/generative-ai"



// 1. Hàm kiểm tra kết nối (Dùng để hiển thị trạng thái xanh/đỏ)

export async function checkConnection() {

  if (!process.env.GEMINI_API_KEY) return false

  try {

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-live" })

    // Test một prompt cực ngắn để check ping

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



    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-live" }) // Dùng bản Flash cho nhanh

    

    const chatPrompt = `Bạn tên là Alpha (ký hiệu 🤖). 

    Vai trò: Chuyên gia đầu tư chứng khoán Việt Nam và là Trợ lý ảo trong nhóm chat.

    Tính cách: Thông minh, ngắn gọn, hài hước.

    Nhiệm vụ: Trả lời câu hỏi user.

    Câu hỏi: "${prompt}"`



    const result = await model.generateContent(chatPrompt)

    const response = await result.response

    const text = response.text()

    

    return { text }

  } catch (error: any) {

    console.error('Gemini Error:', error)

    return { error: 'Alpha đang gặp sự cố kết nối.' }

  }

}
