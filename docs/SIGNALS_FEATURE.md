# 📊 Tính năng Tín hiệu Golden Cross AI

## Tổng quan

Tính năng **Tín hiệu Golden Cross AI** là một công cụ phân tích cổ phiếu tự động, kết hợp:
- 📈 **Phân tích kỹ thuật** (Technical Analysis)
- 💰 **Phân tích cơ bản** (Fundamental Analysis)
- 🤖 **Đánh giá AI với Gemini**

Hệ thống tự động:
1. Lấy danh sách cổ phiếu có tín hiệu **Golden Cross** từ Firebase
2. Lọc các cổ phiếu đạt tiêu chuẩn kỹ thuật và cơ bản
3. Sử dụng Gemini AI để đánh giá chi tiết từng cổ phiếu
4. Đưa ra khuyến nghị: **MUA**, **THEO DÕI**, hoặc **BỎ QUA**
5. Lưu các khuyến nghị "MUA" vào Firebase để theo dõi hiệu quả

---

## 🎯 Tính năng chính

### 1. Widget Golden Cross Signals
**Vị trí:** `/signals` (Premium only)

**Chức năng:**
- Hiển thị danh sách cổ phiếu có tín hiệu Golden Cross
- Tự động lọc theo tiêu chí:
  - ✅ MA10 > MA30 (Golden Cross đã xảy ra hoặc xu hướng tăng)
  - ✅ P/E dương và hợp lý (< 25)
  - ✅ P/B < 3
  - ✅ ROE > 10%
  - ✅ ROE có xu hướng cải thiện (nếu có dữ liệu chi tiết)

**Thao tác:**
- 🤖 **Đánh giá AI**: Phân tích từng cổ phiếu với Gemini
- 🤖 **Phân tích tất cả với AI**: Tự động phân tích toàn bộ danh sách
- 💾 **Lưu khuyến nghị**: Lưu các cổ phiếu "MUA" vào Firebase

**Kết quả AI bao gồm:**
- ⚡ Tín hiệu ngắn hạn (1-4 tuần) với độ tin cậy
- 🎯 Tín hiệu dài hạn (3-12 tháng) với độ tin cậy
- 💰 Giá mục tiêu (Target Price)
- 🛑 Mức cắt lỗ (Stop Loss)
- ⚠️ Rủi ro
- 💡 Cơ hội

---

### 2. Widget Recommendations Performance
**Vị trí:** `/signals` (Premium only)

**Chức năng:**
- Hiển thị tất cả khuyến nghị "MUA" đã lưu
- So sánh giá khuyến nghị vs giá hiện tại
- Tính toán lợi nhuận/lỗ theo thời gian thực
- Thống kê hiệu quả tổng thể:
  - Tỷ lệ thắng (Win Rate)
  - Lợi nhuận trung bình
  - Khuyến nghị tốt nhất / tệ nhất

**Bộ lọc:**
- 🔵 **Tất cả**: Hiển thị toàn bộ khuyến nghị
- 🔵 **Đang theo dõi**: Các khuyến nghị chưa đạt mục tiêu hoặc cắt lỗ
- 🟢 **Đạt mục tiêu**: Giá đã đạt Target Price
- 🔴 **Cắt lỗ**: Giá đã chạm Stop Loss

**Thao tác:**
- 🔄 **Cập nhật giá**: Lấy giá hiện tại từ VNDirect cho tất cả khuyến nghị

---

## 🔧 Cấu trúc kỹ thuật

### Services
**File:** `services/goldenCross.service.ts`

**Functions:**
```typescript
// Lấy danh sách cổ phiếu Golden Cross từ Firebase
getGoldenCrossStocks(): Promise<GoldenCrossStock[]>

// Lưu khuyến nghị MUA
saveBuyRecommendation(recommendation): Promise<string>

// Lấy danh sách khuyến nghị (có thể lọc theo status)
getBuyRecommendations(status?): Promise<StockRecommendation[]>

// Cập nhật status và giá hiện tại
updateRecommendationStatus(id, currentPrice, status?): Promise<void>

// Tính toán metrics hiệu quả
calculatePerformanceMetrics(): Promise<PerformanceMetrics>

// Tự động cập nhật giá cho tất cả khuyến nghị active
updateAllRecommendationsWithCurrentPrices(): Promise<void>
```

---

### API Endpoints

#### 1. GET `/api/signals/golden-cross`
Lấy danh sách cổ phiếu Golden Cross từ Firebase.

**Response:**
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "symbol": "VNM",
      "date": "2025-12-03T00:00:00Z",
      "ma10": 85000,
      "ma30": 83000,
      "price": 86000,
      "volume": 5000000,
      "crossDate": "2025-12-01"
    }
  ]
}
```

---

#### 2. POST `/api/signals/batch-analysis`
Phân tích batch nhiều cổ phiếu, lọc những cổ phiếu đạt tiêu chuẩn.

**Request:**
```json
{
  "symbols": ["VNM", "HPG", "VIC", "VCB"]
}
```

**Response:**
```json
{
  "success": true,
  "total": 4,
  "filtered": 2,
  "data": [
    {
      "symbol": "VNM",
      "currentPrice": 86000,
      "ma10": 85000,
      "ma30": 83000,
      "pe": 18.5,
      "pb": 2.1,
      "roe": 25.3,
      "fundamentalScore": 4,
      "fundamentalReasons": [
        "P/E: 18.50",
        "P/B: 2.10",
        "ROE: 25.30%",
        "ROE cải thiện: 26.20%"
      ]
    }
  ]
}
```

---

#### 3. GET/POST/PATCH `/api/signals/recommendations`

**GET** - Lấy danh sách khuyến nghị
```
GET /api/signals/recommendations
GET /api/signals/recommendations?status=active
```

**POST** - Lưu khuyến nghị mới
```json
{
  "symbol": "VNM",
  "recommendedPrice": 86000,
  "currentPrice": 86000,
  "targetPrice": "95,000 - 100,000",
  "stopLoss": "82,000",
  "confidence": 75,
  "aiSignal": "MUA",
  "technicalAnalysis": ["MA10 > MA30", "..."],
  "fundamentalAnalysis": ["P/E: 18.5", "..."],
  "risks": ["..."],
  "opportunities": ["..."]
}
```

**PATCH** - Cập nhật status và giá
```json
{
  "id": "rec_123",
  "currentPrice": 88000,
  "status": "active"
}
```

---

### Components

#### 1. `GoldenCrossSignalsWidget.tsx`
**Props:** None (fetches data internally)

**State:**
- `stocks`: Danh sách cổ phiếu đã lọc
- `analyzingAll`: Đang phân tích tất cả với AI
- `selectedStocks`: Các cổ phiếu được chọn

**Features:**
- Tự động lọc cổ phiếu đạt tiêu chuẩn
- Phân tích từng cổ phiếu hoặc toàn bộ với Gemini
- Hiển thị kết quả AI đầy đủ
- Lưu khuyến nghị "MUA" vào Firebase

---

#### 2. `RecommendationsPerformanceWidget.tsx`
**Props:** None

**State:**
- `recommendations`: Danh sách khuyến nghị
- `metrics`: Metrics tổng hợp
- `filterStatus`: Bộ lọc (all/active/completed/stopped)
- `updating`: Đang cập nhật giá

**Features:**
- Hiển thị metrics tổng quan
- Lọc theo status
- Tính toán lợi nhuận real-time
- Cập nhật giá hàng loạt

---

## 📦 Cấu trúc dữ liệu Firebase

### Node: `goldenCross`
```
goldenCross/
  ├── VNM/
  │   ├── symbol: "VNM"
  │   ├── date: "2025-12-03T..."
  │   ├── ma10: 85000
  │   ├── ma30: 83000
  │   ├── price: 86000
  │   ├── volume: 5000000
  │   └── crossDate: "2025-12-01"
  ├── HPG/
  │   └── ...
```

### Node: `buyRecommendations`
```
buyRecommendations/
  ├── -N1abc123/
  │   ├── symbol: "VNM"
  │   ├── recommendedPrice: 86000
  │   ├── currentPrice: 88000
  │   ├── targetPrice: "95,000 - 100,000"
  │   ├── stopLoss: "82,000"
  │   ├── confidence: 75
  │   ├── aiSignal: "MUA"
  │   ├── technicalAnalysis: [...]
  │   ├── fundamentalAnalysis: [...]
  │   ├── risks: [...]
  │   ├── opportunities: [...]
  │   ├── createdAt: "2025-12-03T..."
  │   ├── lastUpdated: "2025-12-03T..."
  │   └── status: "active"
```

---

## 🔐 Biến môi trường

Cần thêm vào **Vercel Environment Variables**:

```env
# Firebase Realtime Database
FIREBASE_URL=https://your-project-default-rtdb.region.firebasedatabase.app
FIREBASE_SECRET=your_firebase_database_secret
```

**Lấy credentials:**
1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project
3. Vào **Realtime Database**
4. Copy **Database URL** → `FIREBASE_URL`
5. Vào **Project Settings > Service Accounts > Database Secrets**
6. Tạo hoặc copy secret → `FIREBASE_SECRET`

---

## 💡 Đề xuất tối ưu

### 1. **Automation với Cron Jobs**
Tạo API endpoint `/api/cron/update-golden-cross` để:
- Tự động quét thị trường tìm Golden Cross mỗi ngày
- Cập nhật Firebase với danh sách mới
- Gửi thông báo cho Premium users

**Vercel Cron:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/update-golden-cross",
      "schedule": "0 17 * * 1-5"  // 5PM mỗi ngày từ T2-T6
    },
    {
      "path": "/api/cron/update-recommendations",
      "schedule": "0 9,15 * * 1-5"  // 9AM và 3PM
    }
  ]
}
```

---

### 2. **Real-time Alerts với ZNS**
Gửi thông báo Zalo khi:
- ✅ Có cổ phiếu Golden Cross mới
- ✅ Khuyến nghị đạt target price
- ⚠️ Khuyến nghị chạm stop loss
- 📊 Báo cáo hiệu quả hàng tuần

---

### 3. **Advanced Filtering**
Thêm bộ lọc nâng cao:
- Volume spike (khối lượng bất thường)
- News sentiment analysis
- Industry sector filtering
- Market cap ranges
- Liquidity metrics

---

### 4. **Backtesting**
Tạo tool backtesting để:
- Test chiến lược trên dữ liệu lịch sử
- Đánh giá độ chính xác của AI
- Optimize các threshold
- A/B testing các models

---

### 5. **Portfolio Tracking**
Tích hợp theo dõi portfolio:
- User tự thêm cổ phiếu đang nắm giữ
- Tính P&L tổng thể
- Cảnh báo khi cần rebalance
- Đề xuất mua/bán dựa trên AI

---

### 6. **Social Features**
- Chia sẻ khuyến nghị với cộng đồng
- Voting và comment
- Leaderboard top analysts
- Copy trading (theo dõi khuyến nghị của người khác)

---

### 7. **Mobile App**
Phát triển mobile app với:
- Push notifications
- Quick actions
- Biểu đồ tương tác
- Offline support

---

### 8. **Advanced AI Models**
- Ensemble models (kết hợp nhiều AI)
- Sentiment analysis từ tin tức
- Predictive analytics
- Risk assessment scoring

---

### 9. **Data Visualization**
Thêm biểu đồ:
- Performance over time
- Risk/Return scatter plot
- Sector allocation
- Win rate trends

---

### 10. **Educational Content**
Tạo nội dung hướng dẫn:
- Video tutorials
- Strategy guides
- Risk management tips
- Market insights blog

---

## 🚀 Hướng dẫn sử dụng

### Cho Premium Users:

1. **Truy cập trang Tín hiệu:**
   - Vào `/signals` (chỉ Premium users)

2. **Xem danh sách Golden Cross:**
   - Hệ thống tự động hiển thị cổ phiếu đạt tiêu chuẩn
   - Xem chỉ số kỹ thuật và cơ bản

3. **Đánh giá với AI:**
   - Click **"🤖 Đánh giá AI"** cho từng cổ phiếu
   - Hoặc **"🤖 Phân tích tất cả với AI"** cho toàn bộ

4. **Lưu khuyến nghị:**
   - Với cổ phiếu có khuyến nghị **"MUA"**
   - Click **"💾 Lưu khuyến nghị"**

5. **Theo dõi hiệu quả:**
   - Xem widget **"Hiệu quả Khuyến nghị"**
   - Click **"🔄 Cập nhật giá"** để refresh
   - Lọc theo status để xem chi tiết

---

### Cho Developers:

1. **Setup Firebase:**
   ```bash
   # Thêm vào .env.local
   FIREBASE_URL=https://...
   FIREBASE_SECRET=...
   ```

2. **Cấu trúc data Firebase:**
   - Tạo node `goldenCross` với cấu trúc như trên
   - Node `buyRecommendations` sẽ tự tạo khi có lưu

3. **Test endpoints:**
   ```bash
   # Get golden cross
   curl http://localhost:3000/api/signals/golden-cross

   # Batch analysis
   curl -X POST http://localhost:3000/api/signals/batch-analysis \
     -H "Content-Type: application/json" \
     -d '{"symbols":["VNM","HPG"]}'

   # Get recommendations
   curl http://localhost:3000/api/signals/recommendations
   ```

4. **Deploy lên Vercel:**
   - Thêm environment variables
   - Push code
   - Verify hoạt động

---

## ⚠️ Lưu ý quan trọng

1. **Rate Limiting:**
   - Gemini API có rate limit
   - Thêm delay 2s giữa các requests khi phân tích hàng loạt

2. **Error Handling:**
   - Tất cả API calls đều có try-catch
   - Fallback khi thiếu dữ liệu

3. **Security:**
   - Firebase rules cần setup đúng
   - Chỉ Premium users được truy cập `/signals`

4. **Performance:**
   - Cache results khi có thể
   - Lazy load components
   - Optimize Firebase queries

---

## 📞 Support

Nếu có vấn đề, liên hệ:
- GitHub Issues
- Email support
- Zalo group

---

**Version:** 1.0.0
**Last Updated:** 2025-12-03
**Author:** Claude AI + datvt88
