# API Usage Examples

This guide provides examples of how to use the Market Data Crawler API.

## Base URL

- **Local Development**: `http://localhost:8080`
- **Cloud Run Production**: `https://cpls-crawler-xxxxx.a.run.app` (your actual Cloud Run URL)

## Authentication

Currently, the API endpoints are public (no authentication required). For production, consider adding authentication using:
- Cloud Run IAM
- API Keys
- JWT tokens

## Endpoints

### 1. Health Check

Check if the service is running.

**Request:**
```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "CPLS Market Data Crawler",
  "version": "1.0.0"
}
```

### 2. Start Crawler

Trigger the market data crawling process. This endpoint returns immediately while the crawler runs in the background.

**Request:**
```bash
curl -X POST http://localhost:8080/api/crawler/start
```

**Response:**
```json
{
  "status": "success",
  "message": "Crawling started in background. This process may take several minutes.",
  "note": "Check the status endpoint to monitor progress"
}
```

**Important Notes:**
- The crawler runs in a background goroutine
- The API responds immediately (within milliseconds)
- Actual crawling takes 5-10 minutes for ~2000 stocks
- Check logs for detailed progress

### 3. Get Crawler Status

Get statistics about the crawled data.

**Request:**
```bash
curl http://localhost:8080/api/crawler/status
```

**Response:**
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

**Interpretation:**
- `total_stocks`: Number of stocks saved in the `stocks` collection
- `total_price_buckets`: Number of year buckets in the `stock_prices` collection
  - Example: 2043 stocks × 3 years = ~6129 buckets
- `timestamp`: When the status was queried

## Example Workflows

### First Time Setup

1. **Start the service:**
```bash
go run main.go
# Or use the compiled binary
./cpls-crawler
```

2. **Verify service is running:**
```bash
curl http://localhost:8080/health
```

3. **Trigger initial data crawl:**
```bash
curl -X POST http://localhost:8080/api/crawler/start
```

4. **Wait 5-10 minutes, then check status:**
```bash
curl http://localhost:8080/api/crawler/status
```

### Daily Update Workflow

Schedule a daily crawl using cron or Cloud Scheduler:

```bash
# Cron job (runs daily at 6 PM)
0 18 * * * curl -X POST http://localhost:8080/api/crawler/start
```

Or using Cloud Scheduler:
```bash
gcloud scheduler jobs create http crawler-daily \
  --location=asia-southeast1 \
  --schedule="0 18 * * *" \
  --time-zone="Asia/Ho_Chi_Minh" \
  --uri="https://your-service.a.run.app/api/crawler/start" \
  --http-method=POST
```

### Monitor Progress

Watch logs in real-time during crawling:

**Local:**
```bash
# Service logs will show progress like:
# Worker #1: Processing HPG
# ✓ Worker #1: Saved 270 price records for HPG
# Worker #2: Processing VNM
# ...
```

**Cloud Run:**
```bash
gcloud run services logs read cpls-crawler \
  --platform managed \
  --region asia-southeast1 \
  --limit 100 \
  --format "table(timestamp, textPayload)"
```

## Data Query Examples

After crawling, you can query the data directly from MongoDB.

### MongoDB Queries

**Get all stocks:**
```javascript
db.stocks.find().limit(10)
```

**Get stocks from HOSE exchange:**
```javascript
db.stocks.find({ exchange: "HOSE" })
```

**Get price bucket for HPG in 2024:**
```javascript
db.stock_prices.findOne({ _id: "HPG_2024" })
```

**Get all price buckets for a stock:**
```javascript
db.stock_prices.find({ code: "HPG" })
```

**Count total candles for a stock:**
```javascript
db.stock_prices.aggregate([
  { $match: { code: "HPG" } },
  { $project: { code: 1, year: 1, count: { $size: "$history" } } }
])
```

**Get stocks with most data:**
```javascript
db.stock_prices.aggregate([
  { $group: { _id: "$code", buckets: { $sum: 1 } } },
  { $sort: { buckets: -1 } },
  { $limit: 10 }
])
```

## Error Handling

### Connection Errors

**Problem:** Cannot connect to MongoDB

**Response:**
```json
{
  "status": "error",
  "message": "Failed to connect to database"
}
```

**Solution:**
- Check MONGODB_URI environment variable
- Verify MongoDB Atlas IP whitelist
- Check network connectivity

### API Rate Limiting

**Problem:** VNDirect API blocks requests

**Symptoms:** Logs show many failed requests with 429 or timeout errors

**Solution:**
1. Increase `requestDelay` in `crawler_service.go`
2. Reduce `numWorkers` to 5 or less
3. Wait and retry later

### Timeout Issues

**Problem:** Cloud Run times out

**Note:** This should NOT happen because the API returns immediately and crawling runs in background.

**If it does happen:**
- Check Cloud Run timeout setting (should be 300s)
- Verify goroutine is actually running
- Check service logs

## Performance Metrics

### Expected Performance

| Metric | Value |
|--------|-------|
| API Response Time | < 100ms |
| Total Crawl Time | 5-10 minutes |
| Stocks per Minute | ~300-400 |
| API Request Rate | ~5-7 per second |
| Memory Usage | < 256MB |
| MongoDB Storage | ~150MB for 3 years |

### Monitoring

Monitor these metrics in Cloud Run:
- Request count (should be low, only API triggers)
- Memory usage (should be < 256MB)
- CPU usage (spikes during crawling)
- Container startup time (should be < 5s)

## Tips

1. **First crawl takes longest**: Initial crawl fetches all data
2. **Subsequent crawls are faster**: Only new data is added
3. **Use Cloud Scheduler**: Automate daily updates
4. **Monitor logs**: Check for errors or API blocks
5. **Bucket efficiency**: One year bucket ≈ 365 candles per stock
6. **Storage calculation**: ~50KB per bucket × 6000 buckets = ~300MB

## Troubleshooting

### No data after crawling

**Check:**
1. Service logs for errors
2. MongoDB connection
3. VNDirect API availability
4. Network connectivity

**Debug:**
```bash
# Check service logs
curl http://localhost:8080/api/crawler/status

# Check MongoDB
mongo "mongodb+srv://cluster.mongodb.net" --username user
> use cpls_trading
> db.stocks.count()
> db.stock_prices.count()
```

### Data not updating

**Possible causes:**
1. Crawler not running
2. Duplicate detection working (preventing duplicates)
3. VNDirect API returns no new data

**Solution:**
- Check logs for "No price data for {CODE}"
- Verify dates in VNDirect API response
- Clear old buckets and re-crawl if needed

## Support

For issues or questions:
1. Check service logs first
2. Verify MongoDB connection
3. Test VNDirect API directly
4. Review this documentation

## Next Steps

After crawling data, you can:
1. Build APIs to query stock data
2. Create charts and visualizations
3. Implement real-time updates
4. Add more data sources
5. Create trading signals
