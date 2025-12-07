// File: services/signal.service.ts

// --- 1. Định nghĩa Interface cho Bot Alpha ---
export interface SignalData {
  ticker: string
  price: number
  ma30: number
  timeCross: string
  type?: string
}

// --- 2. Các hàm Fetch RAW (Theo yêu cầu của bạn) ---

/**
 * Fetch RAW data from Firebase Realtime Database using REST API.
 * Requires only FIREBASE_URL + FIREBASE_SECRET
 */
export async function getGoldenCrossStocks(): Promise<any> {
  // Lấy biến môi trường (Server-side only)
  const baseUrl = process.env.FIREBASE_URL; // VD: https://project-id.firebaseio.com
  const secret = process.env.FIREBASE_SECRET; // Database Secret

  if (!baseUrl || !secret) {
    console.error("❌ Missing FIREBASE_URL or FIREBASE_SECRET in environment");
    return null;
  }

  // Endpoint REST API của Firebase
  const url = `${baseUrl}/goldenCross.json?auth=${secret}`;

  try {
    const res = await fetch(url, {
        next: { revalidate: 60 } // Cache 60s để không spam request
    });

    if (!res.ok) {
      console.error("❌ Firebase fetch failed:", res.status, await res.text());
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("❌ Network error fetching Firebase:", error);
    return null;
  }
}

/**
 * Fetch specific ticker (Optional - Dành cho chi tiết mã)
 */
export async function getGoldenCrossStock(ticker: string): Promise<any> {
  const baseUrl = process.env.FIREBASE_URL;
  const secret = process.env.FIREBASE_SECRET;

  if (!baseUrl || !secret) return null;

  const url = `${baseUrl}/goldenCross/${ticker}.json?auth=${secret}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

// --- 3. Hàm Adapter (Kết nối dữ liệu RAW vào Bot Alpha) ---
// Bot Alpha trong file chat-gemini.ts đang gọi hàm này
export async function fetchGoldenCrossSignals(): Promise<SignalData[]> {
  try {
    // Gọi hàm REST API ở trên
    const rawData = await getGoldenCrossStocks();

    if (!rawData) return [];

    // Chuyển đổi Object { "BAF": {...}, "CEO": {...} } thành Array
    const signalsArray = Object.keys(rawData).map(key => {
      const item = rawData[key];
      
      // Xử lý thời gian an toàn
      let timeString = new Date().toISOString();
      if (item.crossDate) timeString = item.crossDate;
      else if (item.timeCross) timeString = item.timeCross;
      else if (item.timestamp) timeString = new Date(item.timestamp).toISOString();

      return {
        ticker: key, // Key chính là mã CK
        price: Number(item.price) || 0,
        ma30: Number(item.ma30) || 0,
        timeCross: timeString,
        type: 'Golden Cross'
      };
    });

    // Sắp xếp: Mới nhất lên đầu
    signalsArray.sort((a, b) => {
        const timeA = new Date(a.timeCross).getTime() || 0;
        const timeB = new Date(b.timeCross).getTime() || 0;
        return timeB - timeA;
    });

    // Lấy 30 mã mới nhất
    return signalsArray.slice(0, 30);

  } catch (error) {
    console.error("Lỗi xử lý dữ liệu cho Bot:", error);
    return [];
  }
}
