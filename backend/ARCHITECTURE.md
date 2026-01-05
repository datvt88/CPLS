# Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT / SCHEDULER                          │
│                    (curl, cron, Cloud Scheduler)                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP Request
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUD RUN / SERVER                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    main.go (Gin Server)                     │    │
│  │  • Port 8080                                                │    │
│  │  • CORS Middleware                                          │    │
│  │  • Routes: /health, /api/crawler/*                          │    │
│  └──────────────────────────┬─────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │          controllers/crawler_controller.go                  │    │
│  │  • TriggerCrawl() → Returns immediately                     │    │
│  │  • GetStatus() → Returns statistics                         │    │
│  └──────────────────────────┬─────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │          services/crawler_service.go                        │    │
│  │                                                              │    │
│  │  StartCrawling() [Goroutine]                                │    │
│  │    ├─ Step 1: Fetch stock list                              │    │
│  │    ├─ Step 2: Save to stocks collection                     │    │
│  │    └─ Step 3: Launch worker pool                            │    │
│  │                                                              │    │
│  │  ┌───────────────────────────────────────────┐             │    │
│  │  │     Worker Pool (8 concurrent workers)    │             │    │
│  │  │                                            │             │    │
│  │  │  Worker 1 ─┐                              │             │    │
│  │  │  Worker 2 ─┤                              │             │    │
│  │  │  Worker 3 ─┤  Each worker:                │             │    │
│  │  │  Worker 4 ─┤  1. Fetch prices from API    │             │    │
│  │  │  Worker 5 ─┤  2. Group by year            │             │    │
│  │  │  Worker 6 ─┤  3. Save to buckets          │             │    │
│  │  │  Worker 7 ─┤  4. Sleep 150ms (rate limit) │             │    │
│  │  │  Worker 8 ─┘                              │             │    │
│  │  │                                            │             │    │
│  │  └───────────────────────────────────────────┘             │    │
│  │                                                              │    │
│  └──────────────────────────┬─────────────────────────────────┘    │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              │ MongoDB Driver
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MONGODB ATLAS (Free M0)                         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Database: cpls_trading                                     │    │
│  │                                                              │    │
│  │  Collection: stocks                                          │    │
│  │  ┌──────────────────────────────────────────────────┐      │    │
│  │  │ { code: "HPG", companyName: "Hòa Phát", ... }    │      │    │
│  │  │ { code: "VNM", companyName: "Vinamilk", ... }    │      │    │
│  │  │ ... (~2000 documents)                             │      │    │
│  │  └──────────────────────────────────────────────────┘      │    │
│  │                                                              │    │
│  │  Collection: stock_prices (Bucket Pattern)                  │    │
│  │  ┌──────────────────────────────────────────────────┐      │    │
│  │  │ {                                                 │      │    │
│  │  │   _id: "HPG_2024",                                │      │    │
│  │  │   code: "HPG",                                    │      │    │
│  │  │   year: 2024,                                     │      │    │
│  │  │   history: [                                      │      │    │
│  │  │     { d: "2024-01-01", o: 27.5, h: 28, ... },    │      │    │
│  │  │     { d: "2024-01-02", o: 27.9, h: 28.5, ... },  │      │    │
│  │  │     ... (~270 candles)                            │      │    │
│  │  │   ]                                               │      │    │
│  │  │ }                                                 │      │    │
│  │  │ ... (~6000 buckets for 2000 stocks × 3 years)    │      │    │
│  │  └──────────────────────────────────────────────────┘      │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ HTTP Requests (Resty)
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                       VNDIRECT API                                   │
│                                                                       │
│  • Stock List API:                                                   │
│    GET /v4/stocks?q=type:stock~status:listed~...                    │
│    → Returns ~2000 stocks                                            │
│                                                                       │
│  • Stock Price API:                                                  │
│    GET /v4/stock_prices?q=code:{CODE}&size=270                      │
│    → Returns 270 days of price data                                  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘


DATA FLOW SEQUENCE:
═══════════════════

1. USER → POST /api/crawler/start
2. Controller → Service.StartCrawling()
3. Controller → Returns "Started" (< 100ms) ✓
4. [BACKGROUND] Goroutine starts crawling
5. Fetch stocks from VNDirect → ~2000 stocks
6. Upsert to MongoDB stocks collection
7. Create jobs channel with all stocks
8. Launch 8 workers (goroutines)
9. Each worker:
   a. Receive stock from channel
   b. Fetch 270 days from VNDirect (150ms delay)
   c. Group candles by year
   d. Upsert to stock_prices buckets
   e. Repeat
10. All workers complete → Done! (5-10 minutes)


BUCKET PATTERN STORAGE OPTIMIZATION:
═══════════════════════════════════

Traditional Approach:
  • 2000 stocks × 270 days × 3 years = 1,620,000 documents
  • Each doc: ~300 bytes
  • Total: ~500 MB ❌ (close to 512MB limit)

Bucket Pattern Approach:
  • 2000 stocks × 3 years = 6,000 buckets
  • Each bucket: ~25 KB (270 candles)
  • Total: ~150 MB ✓ (70% savings!)


KEY FEATURES:
════════════

✓ Non-blocking API (background processing)
✓ Worker pool concurrency (8 workers)
✓ Rate limiting (150ms delay)
✓ Storage optimization (70% reduction)
✓ Duplicate detection
✓ Error handling & retry
✓ Cloud Run compatible
✓ MongoDB Free tier friendly
