# Quick Start Guide

Get the Market Data Crawler running in 5 minutes.

## Prerequisites

✅ Go 1.22+ installed  
✅ MongoDB Atlas account (Free M0 tier)  
✅ Internet connection

## Step 1: Configure MongoDB Atlas

### Create Free Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create a free M0 cluster (512MB)
4. Choose region: Singapore (closest to Vietnam)

### Setup Network Access

1. Go to **Network Access**
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (0.0.0.0/0)
4. Confirm

### Create Database User

1. Go to **Database Access**
2. Click **Add New Database User**
3. Username: `cpls_admin`
4. Password: Generate a strong password (save it!)
5. Role: `Atlas admin` or `Read and write to any database`
6. Add User

### Get Connection String

1. Go to **Database** → **Connect**
2. Choose **Connect your application**
3. Driver: **Go**, Version: **1.17 or later**
4. Copy the connection string:
   ```
   mongodb+srv://cpls_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password

## Step 2: Setup Backend

### Clone and Configure

```bash
# Navigate to backend directory
cd backend

# Copy environment template
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor
```

### Update .env file:

```bash
MONGODB_URI=mongodb+srv://cpls_admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=cpls_trading
PORT=8080
ENV=development
```

**Important:** Replace `YOUR_PASSWORD` with your actual MongoDB password!

### Install Dependencies

```bash
go mod download
```

## Step 3: Run the Service

### Option A: Run Directly

```bash
go run main.go
```

### Option B: Build and Run

```bash
# Build
go build -o cpls-crawler main.go

# Run
./cpls-crawler
```

You should see:
```
✓ Connected to MongoDB database: cpls_trading
🚀 Server starting on port 8080
```

## Step 4: Test the API

Open a new terminal and test:

### Test 1: Health Check

```bash
curl http://localhost:8080/health
```

Expected output:
```json
{
  "status": "healthy",
  "service": "CPLS Market Data Crawler",
  "version": "1.0.0"
}
```

### Test 2: Check Initial Status

```bash
curl http://localhost:8080/api/crawler/status
```

Expected output (before crawling):
```json
{
  "status": "success",
  "data": {
    "total_stocks": 0,
    "total_price_buckets": 0,
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### Test 3: Start Crawling

```bash
curl -X POST http://localhost:8080/api/crawler/start
```

Expected output:
```json
{
  "status": "success",
  "message": "Crawling started in background. This process may take several minutes.",
  "note": "Check the status endpoint to monitor progress"
}
```

### Test 4: Monitor Progress

Watch the service logs in your first terminal. You'll see:

```
🚀 Starting market data crawling process...
✓ Fetched 2043 stocks from VNDirect
✓ Saved stocks to database
Worker #1: Processing HPG
Worker #2: Processing VNM
Worker #3: Processing FPT
...
✓ Worker #1: Saved 270 price records for HPG
✓ Worker #2: Saved 268 price records for VNM
...
✅ Crawling process completed!
```

**Wait 5-10 minutes** for the crawl to complete.

### Test 5: Check Results

```bash
curl http://localhost:8080/api/crawler/status
```

After crawling completes:
```json
{
  "status": "success",
  "data": {
    "total_stocks": 2043,
    "total_price_buckets": 6129,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Step 5: Verify Data in MongoDB

### Using MongoDB Compass (GUI)

1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect using your connection string
3. Browse database `cpls_trading`
4. Check collections:
   - `stocks` - should have ~2000 documents
   - `stock_prices` - should have ~6000 documents

### Using MongoDB Shell

```bash
# Connect to MongoDB
mongosh "mongodb+srv://cluster0.xxxxx.mongodb.net" --username cpls_admin

# Switch to database
use cpls_trading

# Count stocks
db.stocks.count()

# Count price buckets
db.stock_prices.count()

# View sample stock
db.stocks.findOne()

# View sample price bucket
db.stock_prices.findOne()

# View HPG 2024 data
db.stock_prices.findOne({ _id: "HPG_2024" })
```

## Troubleshooting

### ❌ Connection refused

**Problem:** Service not running

**Solution:**
```bash
# Make sure service is running
go run main.go
```

### ❌ Failed to connect to MongoDB

**Problem:** MongoDB connection error

**Solutions:**

1. **Check MongoDB URI:**
   ```bash
   # Verify .env file exists and has correct URI
   cat .env
   ```

2. **Check Network Access:**
   - MongoDB Atlas → Network Access
   - Make sure 0.0.0.0/0 is allowed

3. **Check Password:**
   - Make sure special characters are URL-encoded
   - Example: `p@ssw0rd` → `p%40ssw0rd`

4. **Test Connection:**
   ```bash
   mongosh "mongodb+srv://cluster0.xxxxx.mongodb.net" --username cpls_admin
   ```

### ❌ No stocks after crawling

**Problem:** Crawler failed silently

**Solutions:**

1. **Check Logs:**
   - Look for error messages in service output
   - Check for "Failed to fetch stock list"

2. **Test VNDirect API:**
   ```bash
   curl "https://api-finfo.vndirect.com.vn/v4/stocks?q=type:stock~status:listed~floor:HOSE,HNX,UPCOM&size=10"
   ```

3. **Manual Trigger:**
   ```bash
   # Try crawling again
   curl -X POST http://localhost:8080/api/crawler/start
   ```

### ❌ Rate limiting errors

**Problem:** VNDirect blocking requests

**Solution:**
- Edit `backend/services/crawler_service.go`
- Increase `requestDelay` from 150ms to 300ms
- Reduce `numWorkers` from 8 to 5

## Next Steps

Now that your crawler is working:

### 1. Schedule Daily Updates

**Linux/Mac (cron):**
```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 6 PM)
0 18 * * * curl -X POST http://localhost:8080/api/crawler/start
```

### 2. Deploy to Cloud Run

Follow the [Cloud Run Deployment Guide](./CLOUD_RUN_DEPLOYMENT.md) to deploy to production.

### 3. Build Data APIs

Create APIs to query the data:
- Get stock info by code
- Get price history for a stock
- Get latest prices
- Calculate technical indicators

### 4. Integrate with Frontend

Connect your Next.js frontend to fetch and display stock data.

## Useful Commands

```bash
# Start service
go run main.go

# Build binary
go build -o cpls-crawler main.go

# Run binary
./cpls-crawler

# Run tests
go test ./...

# Run tests with coverage
go test ./... -cover

# Format code
go fmt ./...

# Check for errors
go vet ./...

# Update dependencies
go mod tidy

# View dependencies
go mod graph
```

## Performance Tips

1. **First crawl:** Takes 5-10 minutes
2. **Daily updates:** Takes 3-5 minutes (only new data)
3. **Memory usage:** ~100-200 MB during crawling
4. **Storage:** ~150MB for 3 years of data
5. **API calls:** ~2000 stocks × 150ms = ~5 minutes minimum

## Resources

- [API Usage Guide](./API_USAGE.md) - Detailed API documentation
- [Cloud Run Deployment](./CLOUD_RUN_DEPLOYMENT.md) - Production deployment
- [README](./README.md) - Full documentation
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
- [Gin Framework Docs](https://gin-gonic.com/docs/)
- [VNDirect API](https://api-finfo.vndirect.com.vn/)

## Support

Having issues? Check:

1. ✅ MongoDB Atlas is accessible (Network Access: 0.0.0.0/0)
2. ✅ `.env` file exists with correct credentials
3. ✅ VNDirect API is responding (test with curl)
4. ✅ Service is running (check health endpoint)
5. ✅ Logs show no errors

## Success Checklist

After completing this guide, you should have:

- [ ] MongoDB Atlas cluster created and configured
- [ ] Backend service running locally
- [ ] Health check passing
- [ ] Crawler successfully completed
- [ ] ~2000 stocks in database
- [ ] ~6000 price buckets in database
- [ ] Able to query data from MongoDB

Congratulations! Your Market Data Crawler is now operational! 🎉
