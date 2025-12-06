'use server'

import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function askGemini(prompt: string) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { error: 'Chưa cấu hình API Key trên Vercel.' }
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" })
    
    // Cấu hình nhân cách cho Bot Alpha
    const chatPrompt = `Bạn tên là Alpha. Bạn là một trợ lý ảo am hiểu thị trường chứng khoán Việt Nam, hữu ích và vui tính trong một phòng chat chung.
    - Luôn xưng hô là "Alpha" hoặc "mình/tôi".
    - Trả lời ngắn gọn như 1 twist, đi vào trọng tâm nhưng giữ giọng điệu thân thiện.
    - Không trả lời quá dài dòng trừ khi được yêu cầu chi tiết.
    - Nếu ai đó hỏi bạn là ai, hãy nói bạn là Alpha.
    
    Câu hỏi của người dùng: ${prompt}`

    const result = await model.generateContent(chatPrompt)
    const response = result.response
    const text = response.text()
    
    return { text }
  } catch (error) {
    console.error('Gemini Error:', error)
    return { error: 'Alpha đang gặp chút sự cố kết nối, thử lại sau nhé!' }
  }
}
