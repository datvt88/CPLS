// File: services/signals.service.ts
import { database } from '@/lib/firebaseClient'
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database'

export interface SignalData {
  ticker: string
  price: number
  ma30: number
  timeCross: string
  type?: string
}

export async function fetchGoldenCrossSignals(): Promise<SignalData[]> {
  try {
    // 1. SỬA ĐƯỜNG DẪN: Trỏ đúng vào node 'goldenCross' như trong ảnh
    const signalsRef = ref(database, 'goldenCross') 
    
    // 2. Lấy dữ liệu
    // Vì cấu trúc của bạn là danh sách mã (Snapshot), ta lấy toàn bộ node này
    // (Thường danh sách Golden Cross active không quá dài nên lấy hết vẫn ổn)
    const snapshot = await get(signalsRef)

    if (snapshot.exists()) {
      const data = snapshot.val()
      
      const signalsArray = Object.keys(data).map(key => {
        const item = data[key];
        return {
          // Trong ảnh: Key chính là tên mã (BAF, CEO...)
          ticker: key, 
          price: item.price,
          ma30: item.ma30,
          // Fallback nhiều trường hợp tên biến thời gian để tránh lỗi
          timeCross: item.crossDate || item.timeCross || item.timestamp || new Date().toISOString(),
          type: 'Golden Cross'
        }
      })
      
      // 3. Sắp xếp client-side: Mới nhất lên đầu
      signalsArray.sort((a, b) => {
         const timeA = new Date(a.timeCross).getTime() || 0
         const timeB = new Date(b.timeCross).getTime() || 0
         return timeB - timeA
      })

      // Chỉ lấy 30 mã mới nhất để tiết kiệm token cho Bot
      return signalsArray.slice(0, 30) as SignalData[]
    }
    
    return []
  } catch (error) {
    console.error("Lỗi lấy dữ liệu signals:", error)
    return []
  }
}
