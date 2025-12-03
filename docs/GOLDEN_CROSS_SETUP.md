# Hướng dẫn cài đặt Golden Cross Signals

## Tổng quan

Tính năng Golden Cross Signals cho phép người dùng Premium xem danh sách các cổ phiếu có tín hiệu Golden Cross (MA50 vượt lên MA200) được phân tích bởi Gemini AI.

## Kiến trúc

```
┌─────────────────────┐
│  Firebase Realtime  │  ← Lưu trữ danh sách cổ phiếu Golden Cross
│     Database        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  API Route          │  ← /api/signals/golden-cross
│  (Next.js)          │  ← Lấy dữ liệu từ Firebase
└──────────┬──────────┘  ← Phân tích với Gemini AI
           │
           ↓
┌─────────────────────┐
│  GoldenCrossWidget  │  ← Component hiển thị danh sách
│  (React)            │  ← Hành động: Theo dõi / Mua
└─────────────────────┘
```

## Cấu trúc dữ liệu Firebase

Dữ liệu Golden Cross được lưu trữ trong Firebase Realtime Database với cấu trúc:

```json
{
  "goldenCross": {
    "VNM": {
      "ticker": "VNM",
      "name": "Vinamilk",
      "crossDate": "2025-12-01",
      "ma50": 85000,
      "ma200": 82000,
      "price": 86500,
      "volume": 1500000,
      "marketCap": 120000000000000,
      "sector": "Hàng tiêu dùng",
      "lastUpdated": "2025-12-03T10:30:00Z"
    },
    "HPG": {
      "ticker": "HPG",
      "name": "Hoa Phat Group",
      "crossDate": "2025-11-28",
      "ma50": 28500,
      "ma200": 27000,
      "price": 29000,
      "volume": 8000000,
      "marketCap": 80000000000000,
      "sector": "Nguyên vật liệu",
      "lastUpdated": "2025-12-03T10:30:00Z"
    }
  }
}
```

## Cấu hình biến môi trường

### 1. Trên Vercel (Production)

Truy cập Vercel Dashboard và thêm các biến môi trường sau:

1. Vào **Project Settings** → **Environment Variables**

2. Thêm các biến sau:

```bash
# Firebase Realtime Database cho Golden Cross
FIREBASE_URL=https://your-project-golden-cross.firebaseio.com
FIREBASE_SECRET=your_firebase_secret_or_service_account_key

# Gemini AI (đã có sẵn, nhưng cần đảm bảo)
GEMINI_API_KEY=your_existing_gemini_api_key
```

3. Chọn môi trường áp dụng:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. Nhấn **Save**

5. **Redeploy** ứng dụng để áp dụng các biến môi trường mới

### 2. Local Development

Tạo file `.env.local` (nếu chưa có) và thêm:

```bash
# Firebase for Golden Cross
FIREBASE_URL=https://your-project-golden-cross.firebaseio.com
FIREBASE_SECRET=your_firebase_secret

# Gemini AI (nếu chưa có)
GEMINI_API_KEY=your_gemini_api_key
```

**Lưu ý:** File `.env.local` đã được thêm vào `.gitignore`, không bao giờ commit file này lên Git.

## Cách lấy Firebase Credentials

### Option 1: Sử dụng Database URL (Khuyến nghị)

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project của bạn
3. Vào **Realtime Database** → **Data**
4. Copy URL từ thanh địa chỉ (ví dụ: `https://your-project.firebaseio.com`)
5. Paste vào biến `FIREBASE_URL`

### Option 2: Sử dụng Service Account

1. Vào **Project Settings** → **Service Accounts**
2. Nhấn **Generate new private key**
3. Download file JSON
4. Copy toàn bộ nội dung file JSON và paste vào biến `FIREBASE_SECRET`
5. Hoặc chỉ copy giá trị của field `private_key`

## Firebase Database Rules

Đảm bảo Firebase Realtime Database có quy tắc bảo mật phù hợp:

```json
{
  "rules": {
    "goldenCross": {
      ".read": "auth != null",
      ".write": "auth.uid === 'golden-cross-service'"
    }
  }
}
```

Hoặc để test (chỉ dùng trong development):

```json
{
  "rules": {
    "goldenCross": {
      ".read": true,
      ".write": false
    }
  }
}
```

## Testing

### 1. Test API Route

```bash
# Local
curl http://localhost:3000/api/signals/golden-cross?limit=5

# Production
curl https://your-domain.vercel.app/api/signals/golden-cross?limit=5
```

Expected response:

```json
{
  "stocks": [
    {
      "ticker": "VNM",
      "name": "Vinamilk",
      "price": 86500,
      "signal": "MUA",
      "confidence": 85,
      "shortTermSignal": "MUA",
      "longTermSignal": "MUA",
      "targetPrice": "90000-95000",
      "stopLoss": "82000",
      "summary": "Tín hiệu Golden Cross mạnh mẽ...",
      "technicalScore": 85,
      "fundamentalScore": 80
    }
  ],
  "total": 1,
  "timestamp": "2025-12-03T10:30:00Z"
}
```

### 2. Test Component

1. Đăng nhập với tài khoản Premium
2. Vào `/signals`
3. Kiểm tra xem Golden Cross widget có hiển thị
4. Kiểm tra các nút hành động (Theo dõi, Mua)
5. Kiểm tra auto-refresh (5 phút)

## Troubleshooting

### Lỗi: "FIREBASE_URL is not configured"

**Giải pháp:**
- Kiểm tra biến môi trường đã được thêm vào Vercel
- Redeploy ứng dụng sau khi thêm biến
- Kiểm tra tên biến có đúng là `FIREBASE_URL` không (case-sensitive)

### Lỗi: "No golden cross data found in Firebase"

**Giải pháp:**
- Kiểm tra dữ liệu đã được thêm vào Firebase Realtime Database
- Đảm bảo đường dẫn là `/goldenCross`
- Kiểm tra Firebase Rules có cho phép đọc dữ liệu

### Lỗi: "Gemini API error"

**Giải pháp:**
- Kiểm tra `GEMINI_API_KEY` đã được cấu hình
- Kiểm tra API key còn hiệu lực
- Kiểm tra quota của Gemini API

### Widget hiển thị "Đang phân tích..." mãi không xong

**Giải pháp:**
- Mở Developer Console (F12) để xem lỗi
- Kiểm tra API route `/api/signals/golden-cross` có hoạt động
- Kiểm tra network tab để xem request có bị fail

## Tối ưu hóa

### 1. Caching

Thêm caching cho API route để giảm số lượng request đến Firebase và Gemini:

```typescript
// app/api/signals/golden-cross/route.ts
export const revalidate = 300 // Cache 5 phút
```

### 2. Rate Limiting

Implement rate limiting để tránh abuse:

```typescript
// Giới hạn 10 requests/phút/user
```

### 3. Background Job

Tạo cron job để cập nhật Golden Cross signals định kỳ:

```bash
# vercel.json
{
  "crons": [
    {
      "path": "/api/cron/update-golden-cross",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## Đề xuất mở rộng

### 1. Death Cross Signals

Thêm tín hiệu Death Cross (MA50 giảm xuống dưới MA200):

```typescript
// services/deathCross.service.ts
export async function getDeathCrossStocks(): Promise<DeathCrossStock[]>
```

### 2. Multiple Timeframes

Hỗ trợ nhiều khung thời gian:
- Golden Cross: MA20/MA50, MA50/MA100, MA50/MA200
- Cho phép người dùng chọn timeframe

### 3. Alert System

Thông báo real-time khi có Golden Cross mới:
- Push notification
- Email alert
- Telegram bot

### 4. Historical Performance

Theo dõi hiệu suất của các tín hiệu Golden Cross:
- Win rate
- Average gain/loss
- Best/worst performers

### 5. Advanced Filters

Thêm bộ lọc nâng cao:
- Market cap range
- Sector filter
- Volume filter
- Confidence threshold
- Recent cross only (7 days, 30 days, etc.)

### 6. Backtest

Tính năng backtest để đánh giá hiệu quả:
- Kiểm tra lại các tín hiệu trong quá khứ
- Tính toán ROI
- So sánh với benchmark (VNINDEX)

## API Endpoints

### GET /api/signals/golden-cross

**Parameters:**
- `limit` (optional): Số lượng cổ phiếu trả về (default: 10, max: 50)
- `model` (optional): Gemini model (default: gemini-2.0-flash)

**Response:**
```json
{
  "stocks": [...],
  "total": 10,
  "model": "gemini-2.0-flash",
  "timestamp": "2025-12-03T10:30:00Z"
}
```

## Component Props

### GoldenCrossWidget

```typescript
interface GoldenCrossWidgetProps {
  limit?: number              // Default: 10
  autoRefresh?: boolean       // Default: false
  refreshInterval?: number    // Default: 300000 (5 phút)
}
```

**Usage:**
```tsx
<GoldenCrossWidget
  limit={15}
  autoRefresh={true}
  refreshInterval={300000}
/>
```

## Performance

- **Firebase Read**: ~200ms
- **Gemini AI Analysis**: ~1-2s per stock
- **Total Load Time**: ~5-10s for 10 stocks
- **Auto Refresh**: Every 5 minutes

## Security

- ✅ Premium membership required
- ✅ Protected route with authentication
- ✅ Environment variables secured on Vercel
- ✅ Firebase rules restrict write access
- ✅ No sensitive data exposed to client

## Support

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs trên Vercel
2. Xem Firebase Console để kiểm tra dữ liệu
3. Test API route trực tiếp
4. Liên hệ team dev với thông tin chi tiết về lỗi
