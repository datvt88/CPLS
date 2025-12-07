// File: services/signals.service.ts
import { database } from '@/lib/firebaseClient'
import { ref, get } from 'firebase/database'

export interface SignalData {
  ticker: string
  price: number
  ma30: number
  timeCross: string
  type?: string
}

export async function fetchGoldenCrossSignals(): Promise<SignalData[]> {
  try {
    // Trỏ đúng vào node 'goldenCross' như ảnh bạn gửi
    const signalsRef = ref(database, 'goldenCross') 
    
    // Lấy toàn bộ dữ liệu trong node này
    const snapshot = await get(signalsRef)

    if (snapshot.exists()) {
      const data = snapshot.val()
      
      const signalsArray = Object.keys(data).map(key => {
        const item = data[key];
        return {
          // Key chính là tên mã (BAF, CEO...)
          ticker: key, 
          price: item.price || 0,
          ma30: item.ma30 || 0,
          // Lấy trường thời gian, ưu tiên crossDate
          timeCross: item.crossDate || item.timeCross || item.timestamp || new Date().toISOString(),
          type: 'Golden Cross'
        }
      })
      
      // Sắp xếp: Mới nhất lên đầu (Dựa vào thời gian)
      signalsArray.sort((a, b) => {
         const timeA = new Date(a.timeCross).getTime() || 0
         const timeB = new Date(b.timeCross).getTime() || 0
         return timeB - timeA
      })

      // Chỉ lấy 30 mã mới nhất để đưa vào Prompt cho gọn
      return signalsArray.slice(0, 30) as SignalData[]
    }
    
    return []
  } catch (error) {
    console.error("Lỗi lấy dữ liệu signals:", error)
    return []
  }
}
