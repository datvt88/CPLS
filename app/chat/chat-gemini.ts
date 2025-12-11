// File: app/chat/chat-gemini.ts
'use server'

import { geminiAlpha } from '@/lib/gemini'
import { fetchGoldenCrossSignals } from '@/services/signal.service'

/**
 * Kiểm tra kết nối Gemini API
 */
export async function checkConnection(): Promise<boolean> {
  return await geminiAlpha.checkConnection()
}

/**
 * Chat với Gemini Alpha AI
 * Tự động lấy context tín hiệu thị trường
 */
export async function askGemini(prompt: string) {
  try {
    // Lấy dữ liệu tín hiệu thị trường
    let signalsContext = 'Hiện tại chưa lấy được dữ liệu tín hiệu.'

    try {
      const signals = await fetchGoldenCrossSignals()
      signalsContext = geminiAlpha.formatSignalsContext(signals)
    } catch (err) {
      console.error('Lỗi đọc dữ liệu signals:', err)
      // Nếu lỗi database, bot vẫn hoạt động nhưng không có dữ liệu
    }

    // Gọi Gemini Alpha với context
    return await geminiAlpha.ask(prompt, signalsContext)
  } catch (error: any) {
    console.error('askGemini Error:', error)
    return { error: 'Alpha đang gặp sự cố kết nối.' }
  }
}
