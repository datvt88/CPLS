# CPLS Backend - Market Data Crawler

Go backend service for crawling and storing Vietnamese stock market data from VNDirect API.

## 🏗️ Architecture

- **Framework**: Gin (Go 1.22+)
- **Database**: MongoDB Atlas (Free M0 - 512MB)
- **Deployment**: Google Cloud Run
- **Pattern**: Bucket Pattern for time-series data optimization

## 📁 Project Structure

```
backend/
├── main.go                 # Application entry point
├── config/
│   └── database.go        # MongoDB connection setup
├── models/
│   ├── stock.go           # Stock model
│   └── price_bucket.go    # Price bucket model (time-series)
├── services/
│   └── crawler_service.go # Crawler logic with worker pool
├── controllers/
│   └── crawler_controller.go # HTTP handlers
└── .env.example           # Environment variables template
```

## 🗄️ Database Schema

### Collection: `stocks`
Stores basic stock information:
```json
{
  "_id": ObjectId,
  "code": "HPG",
  "companyName": "Tập đoàn Hòa Phát",
  "exchange": "HOSE",
  "type": "stock",
  "status": "listed",
  "createdAt": DateTime,
  "updatedAt": DateTime
}
```

### Collection: `stock_prices` (Bucket Pattern)
Each document represents one stock for one year:
```json
{
  "_id": "HPG_2024",
  "code": "HPG",
  "year": 2024,
  "history": [
    {
      "d": "2024-01-01",
      "o": 27.5,
      "h": 28.0,
      "l": 27.2,
      "c": 27.9,
      "v": 1500000
    }
  ]
}
```

**Benefits of Bucket Pattern:**
- Reduces document count by ~365x (one doc per year instead of per day)
- Saves storage space with abbreviated field names (o, h, l, c, v)
- Optimized for MongoDB Free tier (512MB limit)
- Efficient queries for year-based data

## 🚀 Getting Started

### Prerequisites

- Go 1.22 or higher
- MongoDB Atlas account (Free M0 tier)

### Installation

1. **Clone the repository**
```bash
cd backend
```

2. **Install dependencies**
```bash
go mod download
```

3. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your MongoDB credentials
```

4. **Run the application**
```bash
go run main.go
```

Server will start on port 8080 (or PORT from environment).

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns service health status.

### Start Crawler
```
POST /api/crawler/start
```
Triggers the market data crawling process in background.

**Response:**
```json
{
  "status": "success",
  "message": "Crawling started in background. This process may take several minutes.",
  "note": "Check the status endpoint to monitor progress"
}
```

### Get Crawler Status
```
GET /api/crawler/status
```
Returns crawling statistics.

**Response:**
```json
{
  "status": "success",
  "data": {
    "total_stocks": 2000,
    "total_price_buckets": 15000,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## ⚙️ Crawler Features

### Worker Pool Pattern
- **8 concurrent workers** to fetch data in parallel
- Prevents API overload
- Efficient resource usage

### Rate Limiting
- **150ms delay** between requests
- Prevents IP blocking from VNDirect
- Cloud Run friendly

### Data Processing
1. Fetches ~2000 listed stocks from VNDirect
2. For each stock, fetches last 270 days of price data
3. Groups data by year
4. Upserts into MongoDB buckets
5. Prevents duplicate entries

### Background Processing
- API returns immediately after triggering
- Crawler runs in goroutine
- Avoids Cloud Run timeout issues (5+ minutes crawl time)

## 🌐 VNDirect API Integration

### Stock List API
```
GET https://api-finfo.vndirect.com.vn/v4/stocks?q=type:stock~status:listed~floor:HOSE,HNX,UPCOM&size=9999
```

### Stock Price API
```
GET https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:{CODE}&size=270
```

## ☁️ Cloud Run Deployment

### Build Docker Image
```bash
# Create Dockerfile
docker build -t gcr.io/YOUR_PROJECT/cpls-crawler .
docker push gcr.io/YOUR_PROJECT/cpls-crawler
```

### Deploy to Cloud Run
```bash
gcloud run deploy cpls-crawler \
  --image gcr.io/YOUR_PROJECT/cpls-crawler \
  --platform managed \
  --region asia-southeast1 \
  --set-env-vars MONGODB_URI=your_uri,MONGODB_DATABASE=cpls_trading
```

### Environment Variables in Cloud Run
Set these in Cloud Run configuration:
- `MONGODB_URI`: MongoDB Atlas connection string
- `MONGODB_DATABASE`: Database name (default: cpls_trading)
- `PORT`: Auto-set by Cloud Run

## 📊 Storage Optimization

With Bucket Pattern for ~2000 stocks × 270 days × 3 years:

**Without Bucket Pattern:**
- Documents: ~1,620,000
- Estimated size: ~500MB

**With Bucket Pattern:**
- Documents: ~6,000 (2000 stocks × 3 years)
- Estimated size: ~150MB
- **Savings: ~70%**

## 🔧 Development

### Run with hot reload
```bash
# Install air for hot reload
go install github.com/cosmtrek/air@latest

# Run with air
air
```

### Build for production
```bash
go build -o cpls-crawler main.go
./cpls-crawler
```

## 📝 Notes

- First crawl takes 5-10 minutes for 2000 stocks
- Subsequent crawls only update new data
- MongoDB Free tier (512MB) is sufficient for ~5 years of data
- Rate limiting prevents VNDirect API blocks

## 🐛 Troubleshooting

### Connection timeout
- Check MongoDB Atlas IP whitelist (allow 0.0.0.0/0 for Cloud Run)
- Verify MONGODB_URI is correct

### API rate limiting
- Increase `requestDelay` in `crawler_service.go`
- Reduce `numWorkers` for slower crawling

### Out of memory
- Reduce batch size in crawler
- Monitor Cloud Run memory usage

## 📚 Dependencies

```
go.mongodb.org/mongo-driver    # MongoDB driver
github.com/gin-gonic/gin       # Web framework
github.com/go-resty/resty/v2   # HTTP client
github.com/joho/godotenv       # Environment variables
```

## 🔐 Security

- Never commit `.env` file
- Use MongoDB Atlas network access control
- Set strong MongoDB credentials
- Use Cloud Run IAM for access control
