# CPLS - Cổ Phiếu Lướt Sóng
## Kiến Trúc Hệ Thống & Sơ Đồ Cấu Trúc Logic

---

## 1. TỔNG QUAN HỆ THỐNG

**CPLS** (Cổ Phiếu Lướt Sóng) là nền tảng phân tích cổ phiếu thông minh với AI, được xây dựng trên nền tảng Next.js với kiến trúc Full-stack.

### Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Next.js 16 │  │  React 18   │  │ TailwindCSS │              │
│  │  App Router │  │  TypeScript │  │  MUI v7     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                    STATE MANAGEMENT                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   React     │  │    SWR      │  │ localStorage│              │
│  │   Context   │  │   Cache     │  │   Cookies   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                        BACKEND                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Next.js    │  │  Services   │  │    API      │              │
│  │ API Routes  │  │   Layer     │  │   Proxy     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│                   EXTERNAL SERVICES                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Supabase   │  │  Firebase   │  │   Gemini    │              │
│  │ PostgreSQL  │  │  Realtime   │  │     AI      │              │
│  │   + Auth    │  │  Database   │  │             │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐                                                 │
│  │  VNDirect   │                                                 │
│  │  Stock API  │                                                 │
│  └─────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. SƠ ĐỒ CẤU TRÚC THƯ MỤC

```
CPLS/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (providers, metadata)
│   ├── page.tsx                  # Landing page
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── gemini/               # AI analysis endpoints
│   │   ├── market/               # Market data endpoints
│   │   ├── signals/              # Trading signals endpoints
│   │   ├── vndirect/             # Stock data proxy
│   │   └── admin/                # Admin operations
│   ├── dashboard/                # Dashboard page
│   ├── stocks/                   # Stock analysis page
│   ├── market/                   # Market overview page
│   ├── signals/                  # Trading signals page
│   ├── chat/                     # Chat room page
│   ├── profile/                  # User profile page
│   ├── login/                    # Login page
│   └── admin/                    # Admin panel
│
├── components/                   # React Components
│   ├── market/                   # Market widgets
│   ├── ui/                       # Shared UI components
│   ├── GeminiAnalysisWidget.tsx  # AI analysis component
│   ├── StockDetailsWidget.tsx    # Stock chart component
│   └── ...                       # Other components
│
├── contexts/                     # React Context Providers
│   ├── PermissionsContext.tsx    # User permissions state
│   └── StockHubContext.tsx       # Stock data cache
│
├── hooks/                        # Custom React Hooks
│   ├── usePermissions.ts         # Access permissions
│   ├── useFeatureAccess.ts       # Feature access control
│   └── useGeminiUsageLimit.ts    # AI usage limits
│
├── lib/                          # Core Libraries
│   ├── supabase/                 # Supabase client
│   ├── gemini/                   # Gemini AI integration
│   ├── firebase/                 # Firebase configuration
│   ├── permissions.ts            # Permission definitions
│   └── session-manager.ts        # Session management
│
├── services/                     # Business Logic Services
│   ├── auth.service.ts           # Authentication service
│   ├── profile.service.ts        # Profile management
│   ├── vndirect.ts               # VNDirect API service
│   ├── recommendations.service.ts # AI recommendations
│   └── signal.service.ts         # Signal processing
│
├── types/                        # TypeScript Types
│   ├── vndirect.ts               # Stock data types
│   ├── signal.ts                 # Signal types
│   └── market.ts                 # Market data types
│
├── utils/                        # Utility Functions
│   ├── formatters.ts             # Number/date formatters
│   └── validation.ts             # Input validation
│
├── styles/                       # Global CSS
├── public/                       # Static assets
└── supabase/                     # Database migrations
```

---

## 3. SƠ ĐỒ LUỒNG DỮ LIỆU TỔNG QUAN (DATA FLOW)

```
┌──────────────────────────────────────────────────────────────────────┐
│                              USER                                     │
│                               │                                       │
│                               ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                      NEXT.JS PAGES                           │     │
│  │   /dashboard  /stocks  /market  /signals  /chat  /profile   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                               │                                       │
│              ┌────────────────┼────────────────┐                     │
│              ▼                ▼                ▼                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │   CONTEXTS    │  │   COMPONENTS  │  │    HOOKS      │            │
│  │ Permissions   │  │   Widgets     │  │ usePermissions│            │
│  │ StockHub      │  │   Charts      │  │ useGeminiLimit│            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
│              │                │                │                     │
│              └────────────────┼────────────────┘                     │
│                               ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                      SWR CACHE                               │     │
│  │        (Client-side caching with revalidation)               │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                               │                                       │
│                               ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    API ROUTES (/api/*)                       │     │
│  │   /auth  /gemini  /market  /signals  /vndirect  /admin      │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                               │                                       │
│              ┌────────────────┼────────────────┐                     │
│              ▼                ▼                ▼                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │   SERVICES    │  │   LIB        │   │   EXTERNAL    │            │
│  │ auth.service  │  │ gemini/       │  │   APIS        │            │
│  │ vndirect.ts   │  │ supabase/     │  │   VNDirect    │            │
│  │ profile.svc   │  │ firebase/     │  │   Gemini AI   │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
│              │                │                │                     │
│              └────────────────┼────────────────┘                     │
│                               ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                      DATABASES                               │     │
│  │   ┌─────────────────┐        ┌─────────────────┐            │     │
│  │   │    Supabase     │        │    Firebase     │            │     │
│  │   │   PostgreSQL    │        │    Realtime     │            │     │
│  │   │   - profiles    │        │  - chatMessages │            │     │
│  │   │   - signals     │        │  - buyRecommend │            │     │
│  │   │   - auth.users  │        │                 │            │     │
│  │   └─────────────────┘        └─────────────────┘            │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. SƠ ĐỒ XÁC THỰC (AUTHENTICATION FLOW)

```
                          ┌──────────────────┐
                          │      USER        │
                          └────────┬─────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
     │ Email/Password │  │  Google OAuth  │  │   Zalo OAuth   │
     │                │  │                │  │                │
     └───────┬────────┘  └───────┬────────┘  └───────┬────────┘
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                                 ▼
                    ┌───────────────────────┐
                    │   auth.service.ts     │
                    │   - signIn()          │
                    │   - signUp()          │
                    │   - signInWithGoogle()│
                    │   - signInWithZalo()  │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Supabase Auth       │
                    │   - JWT Token (8h)    │
                    │   - Refresh (90d)     │
                    │   - PKCE Flow         │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │ Session Store  │ │  Profile Sync  │ │ Device Tracking│
     │ - Cookies      │ │  - profiles    │ │ - fingerprint  │
     │ - localStorage │ │  - membership  │ │ - multi-device │
     └────────────────┘ └────────────────┘ └────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  PermissionsContext   │
                    │  - isAuthenticated    │
                    │  - isPremium          │
                    │  - role               │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Protected Routes    │
                    │   ProtectedRoute.tsx  │
                    │   ProtectedFeature    │
                    │   AdminRoute.tsx      │
                    └───────────────────────┘
```

---

## 5. SƠ ĐỒ PHÂN TÍCH CỔ PHIẾU (STOCK ANALYSIS FLOW)

```
                    ┌─────────────────────────┐
                    │     User Input          │
                    │   (Stock Symbol: TCB)   │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     /stocks page        │
                    │  StockHubContext.tsx    │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   Price Data  │      │   Ratios      │      │ Recommendations│
│  /api/vndirect│      │  /api/vndirect│      │   /api/dnse   │
│  /stock-prices│      │  /ratios      │      │ /profitability │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        │              ┌───────┴───────┐              │
        │              │   VNDirect    │              │
        │              │   External    │              │
        │              │   API         │              │
        │              └───────────────┘              │
        │                                             │
        └─────────────────────┬───────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────┐
                    │    StockHubContext      │
                    │   (Centralized Cache)   │
                    │  - prices               │
                    │  - ratios               │
                    │  - recommendations      │
                    │  - technicals           │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│StockDetails   │      │StockFinancials│      │GeminiAnalysis │
│  Widget       │      │  Widget       │      │  Widget       │
│(TradingView)  │      │  (P/E, P/B)   │      │  (AI Signal)  │
└───────────────┘      └───────────────┘      └───────┬───────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │   /api/gemini   │
                                            │ - Market Context│
                                            │ - Technical Ind │
                                            │ - Gemini AI API │
                                            └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │   AI Response   │
                                            │ - Signal (BUY/  │
                                            │   SELL/HOLD)    │
                                            │ - Confidence    │
                                            │ - Analysis      │
                                            └─────────────────┘
```

---

## 6. SƠ ĐỒ TRADING SIGNALS FLOW

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SIGNAL GENERATION                              │
│                                                                       │
│  ┌─────────────────┐       ┌─────────────────┐                       │
│  │  Golden Cross   │       │   AI Analysis   │                       │
│  │   Detection     │       │    (Gemini)     │                       │
│  │                 │       │                 │                       │
│  │ - MA10/MA20     │       │ - Technical     │                       │
│  │ - MA20/MA50     │       │ - Fundamental   │                       │
│  │ - Crossover     │       │ - Sentiment     │                       │
│  └────────┬────────┘       └────────┬────────┘                       │
│           │                         │                                 │
│           └────────────┬────────────┘                                │
│                        │                                              │
│                        ▼                                              │
│           ┌───────────────────────┐                                  │
│           │   /api/signals/*      │                                  │
│           │   - golden-cross      │                                  │
│           │   - batch-analysis    │                                  │
│           │   - recommendations   │                                  │
│           └───────────┬───────────┘                                  │
│                       │                                               │
│                       ▼                                               │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    SIGNAL OUTPUT                             │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │     │
│  │  │    BUY      │  │    SELL     │  │    HOLD     │          │     │
│  │  │ Confidence  │  │ Confidence  │  │ Confidence  │          │     │
│  │  │ Target Price│  │ Stop Loss   │  │ Wait Signal │          │     │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                       │                                               │
│                       ▼                                               │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                 RECOMMENDATION TRACKING                      │     │
│  │                                                               │     │
│  │  recommendations.service.ts  →  Firebase Realtime DB         │     │
│  │                                                               │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │     │
│  │  │   Active    │  │  Completed  │  │   Stopped   │          │     │
│  │  │ (Tracking)  │  │ (Hit Target)│  │ (Stop Loss) │          │     │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │     │
│  │                                                               │     │
│  │  Performance Metrics:                                         │     │
│  │  - Win Rate (%)                                               │     │
│  │  - Average Gain (%)                                           │     │
│  │  - Best/Worst Performers                                      │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. SƠ ĐỒ COMPONENT HIERARCHY

```
App (layout.tsx)
│
├── Providers.tsx
│   ├── ThemeProvider (next-themes)
│   ├── SWRConfig
│   ├── PermissionsProvider
│   └── StockHubProvider
│
├── Header.tsx
│   ├── Logo
│   ├── Navigation
│   │   ├── Dashboard
│   │   ├── Stocks
│   │   ├── Market
│   │   ├── Signals
│   │   └── Chat
│   ├── ThemeToggle.tsx
│   └── UserMenu (Login/Profile)
│
├── Sidebar.tsx (Mobile)
│   └── MobileMenu.tsx
│
├── ConditionalLayout.tsx
│   └── [Page Content]
│
└── Footer.tsx

Dashboard Page (/dashboard)
│
├── VNIndicesWidget.tsx
├── VNIndexChartWidget.tsx
├── VNIndexEvaluationWidget.tsx
├── TopStocksWidget.tsx
└── MarketSummary

Stocks Page (/stocks)
│
├── StockSearch
├── StockHubContext (Provider)
│   ├── StockDetailsWidget.tsx
│   │   └── LightweightChart.tsx (TradingView)
│   ├── StockSummaryWidget.tsx
│   ├── StockFinancialsWidget.tsx
│   ├── StockProfitabilityWidget.tsx
│   ├── StockProfitStructureWidget.tsx
│   ├── StockRecommendationsWidget.tsx
│   └── GeminiAnalysisWidget.tsx
│
└── GoldenCrossWidget.tsx

Market Page (/market)
│
├── VNIndicesWidget.tsx
├── TopStocksWidget.tsx
├── SimpleCommoditiesWidget.tsx
├── ExchangeRateWidget.tsx
└── SimpleWorldIndicesWidget.tsx

Signals Page (/signals)
│
├── SignalCard.tsx (list)
├── GoldenCrossSignalsWidget.tsx
├── RecommendationsPerformanceWidget.tsx
└── RecommendationsHistoryWidget.tsx

Profile Page (/profile)
│
├── SessionInfo.tsx
├── DeviceManagement.tsx
├── ActiveDevices.tsx
└── PasswordManagement.tsx

Chat Page (/chat)
│
└── ChatRoom.tsx (Firebase Realtime)
```

---

## 8. SƠ ĐỒ STATE MANAGEMENT

```
┌──────────────────────────────────────────────────────────────────────┐
│                      STATE ARCHITECTURE                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    GLOBAL STATE                              │     │
│  │                                                               │     │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐   │     │
│  │  │  PermissionsContext     │  │    StockHubContext      │   │     │
│  │  │                         │  │                         │   │     │
│  │  │  - isAuthenticated      │  │  - prices: Map          │   │     │
│  │  │  - isPremium            │  │  - ratios: Map          │   │     │
│  │  │  - role (user/mod/admin)│  │  - recommendations: Map │   │     │
│  │  │  - loading              │  │  - technicals: Map      │   │     │
│  │  │  - error                │  │  - loading states       │   │     │
│  │  │                         │  │                         │   │     │
│  │  │  usePermissions()       │  │  fetchStockData()       │   │     │
│  │  │                         │  │  getAIContext()         │   │     │
│  │  └─────────────────────────┘  └─────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    CACHING LAYER                             │     │
│  │                                                               │     │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐   │     │
│  │  │        SWR              │  │     localStorage        │   │     │
│  │  │                         │  │                         │   │     │
│  │  │  - API response cache   │  │  - Auth tokens          │   │     │
│  │  │  - Revalidation (30s)   │  │  - User preferences     │   │     │
│  │  │  - Deduplication        │  │  - Gemini usage count   │   │     │
│  │  │  - Background refresh   │  │  - Theme setting        │   │     │
│  │  └─────────────────────────┘  └─────────────────────────┘   │     │
│  │                                                               │     │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐   │     │
│  │  │       Cookies           │  │    sessionStorage       │   │     │
│  │  │                         │  │                         │   │     │
│  │  │  - Session tokens       │  │  - Temporary widget     │   │     │
│  │  │  - Supabase auth        │  │    data                 │   │     │
│  │  └─────────────────────────┘  └─────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    LOCAL STATE (Hooks)                       │     │
│  │                                                               │     │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐   │     │
│  │  │   useGeminiUsageLimit   │  │   useFeatureAccess      │   │     │
│  │  │                         │  │                         │   │     │
│  │  │  - dailyLimit (3/20)    │  │  - canAccess()          │   │     │
│  │  │  - currentUsage         │  │  - requirePremium       │   │     │
│  │  │  - isLimitReached       │  │  - featureGating        │   │     │
│  │  └─────────────────────────┘  └─────────────────────────┘   │     │
│  │                                                               │     │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐   │     │
│  │  │    useUserProfile       │  │    useSession           │   │     │
│  │  │                         │  │                         │   │     │
│  │  │  - profile data         │  │  - current session      │   │     │
│  │  │  - updateProfile()      │  │  - device info          │   │     │
│  │  └─────────────────────────┘  └─────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. SƠ ĐỒ API ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────┐
│                         API ROUTES                                    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   AUTHENTICATION                             │     │
│  │                                                               │     │
│  │  POST /api/auth/signin-phone                                  │     │
│  │       ↓                                                       │     │
│  │  auth.service.ts → Supabase Auth                             │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   STOCK DATA (Proxy)                         │     │
│  │                                                               │     │
│  │  GET /api/vndirect/stock-prices?code=TCB&size=270            │     │
│  │  GET /api/vndirect/ratios?code=TCB                           │     │
│  │  GET /api/vndirect/recommendations?code=TCB                  │     │
│  │       ↓                                                       │     │
│  │  vndirect.ts → VNDirect External API → Validate → Cache      │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   AI ANALYSIS                                │     │
│  │                                                               │     │
│  │  POST /api/gemini                                             │     │
│  │       ↓                                                       │     │
│  │  1. Fetch market context (prices, volume)                    │     │
│  │  2. Calculate technicals (MA, Bollinger, Pivot)              │     │
│  │  3. Build prompt with context                                │     │
│  │  4. Call Gemini API                                           │     │
│  │  5. Parse response → { signal, confidence, analysis }        │     │
│  │                                                               │     │
│  │  POST /api/gemini/stock-analysis                              │     │
│  │       ↓                                                       │     │
│  │  Deep analysis with fundamentals + technicals                │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   MARKET DATA                                │     │
│  │                                                               │     │
│  │  GET /api/market/indices                                      │     │
│  │  GET /api/market/top-gainers                                  │     │
│  │  GET /api/market/commodities                                  │     │
│  │  GET /api/market/exchange-rates                               │     │
│  │  GET /api/market/world-indices                                │     │
│  │       ↓                                                       │     │
│  │  External APIs → Format → Revalidate (3s)                    │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   TRADING SIGNALS                            │     │
│  │                                                               │     │
│  │  GET  /api/signals/recommendations?status=active             │     │
│  │  POST /api/signals/recommendations (save new)                │     │
│  │  GET  /api/signals/recommendations/performance               │     │
│  │  POST /api/signals/golden-cross                               │     │
│  │  POST /api/signals/batch-analysis                             │     │
│  │       ↓                                                       │     │
│  │  recommendations.service.ts → Firebase Realtime DB           │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   ADMIN OPERATIONS                           │     │
│  │                                                               │     │
│  │  POST /api/admin/create-user                                  │     │
│  │  POST /api/admin/reset-password                               │     │
│  │  POST /api/admin/grant-premium                                │     │
│  │       ↓                                                       │     │
│  │  AdminRoute protection → Supabase Admin Client               │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 10. SƠ ĐỒ DATABASE SCHEMA

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (PostgreSQL)                          │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                      auth.users                              │     │
│  │  (Managed by Supabase Auth)                                  │     │
│  │                                                               │     │
│  │  id            UUID        PRIMARY KEY                       │     │
│  │  email         TEXT        UNIQUE                            │     │
│  │  password      TEXT        (encrypted)                       │     │
│  │  created_at    TIMESTAMP                                     │     │
│  │  ...                                                         │     │
│  └───────────────────────────────┬─────────────────────────────┘     │
│                                  │                                    │
│                                  │ 1:1                                │
│                                  ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                       profiles                               │     │
│  │                                                               │     │
│  │  id                    UUID    PK, FK → auth.users(id)       │     │
│  │  email                 TEXT    UNIQUE                        │     │
│  │  phone_number          TEXT    REQUIRED                      │     │
│  │  full_name             TEXT                                  │     │
│  │  nickname              TEXT    (2-50 chars)                  │     │
│  │  stock_account_number  TEXT                                  │     │
│  │  avatar_url            TEXT                                  │     │
│  │  zalo_id               TEXT    UNIQUE                        │     │
│  │  birthday              TEXT    (DD/MM/YYYY)                  │     │
│  │  gender                TEXT    ('male'|'female')             │     │
│  │  membership            TEXT    ('free'|'premium')            │     │
│  │  membership_expires_at TIMESTAMP                             │     │
│  │  tcbs_api_key          TEXT                                  │     │
│  │  tcbs_connected_at     TIMESTAMP                             │     │
│  │  created_at            TIMESTAMP                             │     │
│  │  updated_at            TIMESTAMP                             │     │
│  │                                                               │     │
│  │  INDEX: idx_profiles_zalo_id                                 │     │
│  │  INDEX: idx_profiles_phone_number                            │     │
│  │  INDEX: idx_profiles_nickname                                │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                        signals                               │     │
│  │                                                               │     │
│  │  id            UUID        PRIMARY KEY                       │     │
│  │  ticker        TEXT                                          │     │
│  │  signal        TEXT        CHECK ('BUY'|'SELL'|'HOLD')       │     │
│  │  confidence    NUMERIC                                       │     │
│  │  created_at    TIMESTAMP   DEFAULT now()                     │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                     FIREBASE REALTIME DATABASE                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   /buyRecommendations                        │     │
│  │                                                               │     │
│  │  {recommendationId}:                                         │     │
│  │    symbol              STRING    "TCB"                       │     │
│  │    recommendedPrice    NUMBER    24.5                        │     │
│  │    currentPrice        NUMBER    25.0                        │     │
│  │    targetPrice         NUMBER    30.0                        │     │
│  │    stopLoss            NUMBER    22.0                        │     │
│  │    confidence          NUMBER    85                          │     │
│  │    aiSignal            STRING    "Strong Buy"                │     │
│  │    technicalAnalysis   ARRAY     [...]                       │     │
│  │    fundamentalAnalysis ARRAY     [...]                       │     │
│  │    risks               ARRAY     [...]                       │     │
│  │    opportunities       ARRAY     [...]                       │     │
│  │    status              STRING    "active"|"completed"|"stopped"│    │
│  │    createdAt           STRING    ISO date                    │     │
│  │    updatedAt           STRING    ISO date                    │     │
│  │    gainLoss            NUMBER    profit/loss amount          │     │
│  │    gainLossPercent     NUMBER    percentage                  │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    /chatMessages                             │     │
│  │                                                               │     │
│  │  {roomId}:                                                   │     │
│  │    {messageId}:                                              │     │
│  │      userId        STRING                                    │     │
│  │      username      STRING                                    │     │
│  │      content       STRING                                    │     │
│  │      timestamp     NUMBER    (Unix timestamp)                │     │
│  │      reactions     OBJECT    {}                              │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. SƠ ĐỒ PERMISSION & ACCESS CONTROL

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PERMISSION HIERARCHY                               │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                     USER ROLES                               │     │
│  │                                                               │     │
│  │                    ┌─────────┐                               │     │
│  │                    │  ADMIN  │                               │     │
│  │                    │  - All  │                               │     │
│  │                    └────┬────┘                               │     │
│  │                         │                                     │     │
│  │                    ┌────▼────┐                               │     │
│  │                    │   MOD   │                               │     │
│  │                    │ - Most  │                               │     │
│  │                    └────┬────┘                               │     │
│  │                         │                                     │     │
│  │           ┌─────────────┴─────────────┐                      │     │
│  │           │                           │                      │     │
│  │      ┌────▼────┐               ┌──────▼─────┐                │     │
│  │      │ PREMIUM │               │    FREE    │                │     │
│  │      │  USER   │               │    USER    │                │     │
│  │      └─────────┘               └────────────┘                │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    FEATURE ACCESS                            │     │
│  │                                                               │     │
│  │  ┌───────────────────────────────────────────────────────┐   │     │
│  │  │              FREE TIER                                 │   │     │
│  │  │                                                        │   │     │
│  │  │  [x] Dashboard         [x] Stocks (Basic)              │   │     │
│  │  │  [x] Market Overview   [x] Signals (View)              │   │     │
│  │  │  [x] Profile           [x] Chat                        │   │     │
│  │  │  [x] Gemini AI (3 calls/day)                           │   │     │
│  │  └───────────────────────────────────────────────────────┘   │     │
│  │                                                               │     │
│  │  ┌───────────────────────────────────────────────────────┐   │     │
│  │  │              PREMIUM TIER                              │   │     │
│  │  │                                                        │   │     │
│  │  │  [x] All Free Features                                 │   │     │
│  │  │  [x] AI Deep Analysis                                  │   │     │
│  │  │  [x] Portfolio Management                              │   │     │
│  │  │  [x] Price Alerts                                      │   │     │
│  │  │  [x] Gemini AI (20 calls/day)                          │   │     │
│  │  │  [x] Priority Support                                  │   │     │
│  │  └───────────────────────────────────────────────────────┘   │     │
│  │                                                               │     │
│  │  ┌───────────────────────────────────────────────────────┐   │     │
│  │  │              ADMIN TIER                                │   │     │
│  │  │                                                        │   │     │
│  │  │  [x] All Premium Features                              │   │     │
│  │  │  [x] User Management (/management)                     │   │     │
│  │  │  [x] Admin Panel (/admin)                              │   │     │
│  │  │  [x] Create/Delete Users                               │   │     │
│  │  │  [x] Grant Premium                                     │   │     │
│  │  │  [x] System Configuration                              │   │     │
│  │  └───────────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                 PROTECTION COMPONENTS                        │     │
│  │                                                               │     │
│  │  ProtectedRoute.tsx     → Requires authentication           │     │
│  │  ProtectedFeature.tsx   → Requires specific permission      │     │
│  │  AdminRoute.tsx         → Requires admin role               │     │
│  │  useFeatureAccess.ts    → Hook for feature gating           │     │
│  │  useGeminiUsageLimit.ts → Daily usage enforcement           │     │
│  └─────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 12. SESSION MANAGEMENT FLOW

```
┌──────────────────────────────────────────────────────────────────────┐
│                      SESSION LIFECYCLE                                │
│                                                                       │
│  ┌──────────────────┐                                                │
│  │   USER LOGIN     │                                                │
│  └────────┬─────────┘                                                │
│           │                                                           │
│           ▼                                                           │
│  ┌──────────────────────────────────────────────┐                    │
│  │           SESSION CREATION                    │                    │
│  │                                               │                    │
│  │  1. Authenticate with Supabase               │                    │
│  │  2. Generate JWT token (8 hours)             │                    │
│  │  3. Create refresh token (90 days)           │                    │
│  │  4. Store in cookies + localStorage          │                    │
│  │  5. Generate device fingerprint              │                    │
│  │  6. Track device in database                 │                    │
│  └──────────────────────────────────────────────┘                    │
│           │                                                           │
│           ▼                                                           │
│  ┌──────────────────────────────────────────────┐                    │
│  │         PERSISTENT SESSION MANAGER            │                    │
│  │         (PersistentSessionManager.tsx)        │                    │
│  │                                               │                    │
│  │  Features:                                    │                    │
│  │  - Stay logged in indefinitely               │                    │
│  │  - 3-day inactivity auto-logout              │                    │
│  │  - 90-day maximum session lifetime           │                    │
│  │  - Activity tracking (clicks, scrolling)     │                    │
│  │  - Multi-device support (no device limit)    │                    │
│  └──────────────────────────────────────────────┘                    │
│           │                                                           │
│           ▼                                                           │
│  ┌──────────────────────────────────────────────┐                    │
│  │         SESSION VALIDATION                    │                    │
│  │                                               │                    │
│  │  On each page load:                          │                    │
│  │  1. Check token validity                     │                    │
│  │  2. Refresh if needed                        │                    │
│  │  3. Update last activity                     │                    │
│  │  4. Sync with PermissionsContext             │                    │
│  └──────────────────────────────────────────────┘                    │
│           │                                                           │
│           │                 ┌────────────────────┐                   │
│           │                 │  SESSION TIMEOUT   │                   │
│           │                 │  (3 days inactive) │                   │
│           │                 └─────────┬──────────┘                   │
│           │                           │                               │
│           ▼                           ▼                               │
│  ┌──────────────────┐       ┌──────────────────┐                     │
│  │  ACTIVE SESSION  │       │   AUTO LOGOUT    │                     │
│  │  (User browsing) │       │  Redirect to /   │                     │
│  └──────────────────┘       └──────────────────┘                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 13. MÔ TẢ CHI TIẾT CÁC TRANG CHÍNH

### 13.1 Dashboard (/dashboard)

**Mục đích**: Tổng quan thị trường và các chỉ số quan trọng

**Components**:
- `VNIndicesWidget`: Hiển thị các chỉ số VN-Index, HNX, UPCOM, VN30
- `VNIndexChartWidget`: Biểu đồ VN-Index real-time
- `VNIndexEvaluationWidget`: Đánh giá tình trạng thị trường
- `TopStocksWidget`: Top cổ phiếu tăng/giảm

**Data Flow**:
1. Page load → fetch `/api/market/*` endpoints
2. SWR cache với revalidation mỗi 3 giây
3. Render widgets với dữ liệu real-time

### 13.2 Stocks (/stocks)

**Mục đích**: Phân tích chi tiết từng cổ phiếu

**Components**:
- `StockDetailsWidget`: Biểu đồ giá (TradingView Lightweight Charts)
- `StockSummaryWidget`: Thông tin tóm tắt
- `StockFinancialsWidget`: Các chỉ số tài chính (P/E, P/B, ROE, ROA)
- `StockProfitabilityWidget`: Phân tích lợi nhuận
- `StockRecommendationsWidget`: Khuyến nghị của các CTCK
- `GeminiAnalysisWidget`: Phân tích AI

**Data Flow**:
1. User nhập mã cổ phiếu
2. `StockHubContext` fetch dữ liệu từ VNDirect API
3. Cache dữ liệu trong context để share giữa các widget
4. Khi user yêu cầu AI analysis:
   - Tạo context string từ dữ liệu đã fetch
   - Gọi `/api/gemini` với context
   - Hiển thị tín hiệu BUY/SELL/HOLD với confidence

### 13.3 Market (/market)

**Mục đích**: Tổng quan thị trường toàn cầu

**Components**:
- Chỉ số Việt Nam (VNIndex, HNX, UPCOM)
- Top gainers/losers
- Tỷ giá ngoại tệ
- Giá vàng và commodities
- Chỉ số thế giới (S&P 500, Nasdaq, etc.)

### 13.4 Signals (/signals)

**Mục đích**: Quản lý tín hiệu giao dịch

**Components**:
- `GoldenCrossSignalsWidget`: Tín hiệu Golden Cross (MA crossover)
- `RecommendationsPerformanceWidget`: Hiệu suất các khuyến nghị
- `RecommendationsHistoryWidget`: Lịch sử khuyến nghị

**Data Flow**:
1. Tính toán Golden Cross từ dữ liệu giá
2. Lưu khuyến nghị vào Firebase
3. Track performance (win rate, avg gain)

### 13.5 Chat (/chat)

**Mục đích**: Chat room real-time cho users

**Technology**: Firebase Realtime Database

**Features**:
- Real-time messaging
- User presence
- Message reactions

### 13.6 Profile (/profile)

**Mục đích**: Quản lý thông tin cá nhân

**Components**:
- `SessionInfo`: Thông tin session hiện tại
- `DeviceManagement`: Quản lý các thiết bị đã đăng nhập
- `PasswordManagement`: Đổi mật khẩu

---

## 14. GEMINI AI INTEGRATION

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AI ANALYSIS PIPELINE                             │
│                                                                       │
│  ┌────────────────────┐                                              │
│  │   User Request     │  (Stock: TCB, Action: Analyze)               │
│  └──────────┬─────────┘                                              │
│             │                                                         │
│             ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  CONTEXT BUILDING                               │  │
│  │                                                                  │  │
│  │  1. Fetch Stock Price Data (270 days)                           │  │
│  │     → OHLC, Volume, Adjusted prices                             │  │
│  │                                                                  │  │
│  │  2. Calculate Technical Indicators                              │  │
│  │     → MA10, MA20, MA50, MA100, MA200                            │  │
│  │     → Bollinger Bands (20-day, 2 sigma)                         │  │
│  │     → Woodie Pivot Points (Support/Resistance)                  │  │
│  │     → VWAP                                                       │  │
│  │                                                                  │  │
│  │  3. Fetch Fundamental Data                                      │  │
│  │     → P/E, P/B, ROE, ROA                                        │  │
│  │     → EPS, Dividend yield                                       │  │
│  │                                                                  │  │
│  │  4. Get Analyst Recommendations                                 │  │
│  │     → Buy/Sell/Hold distribution                                │  │
│  │     → Target prices                                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│             │                                                         │
│             ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    PROMPT CONSTRUCTION                          │  │
│  │                                                                  │  │
│  │  "Analyze stock {SYMBOL} with the following data:               │  │
│  │   - Current price: {PRICE}                                      │  │
│  │   - 52-week range: {LOW} - {HIGH}                               │  │
│  │   - Technical indicators: {MA, Bollinger, Pivot}                │  │
│  │   - Fundamentals: {P/E, P/B, ROE}                               │  │
│  │   - Recommendations: {BUY: X, SELL: Y, HOLD: Z}                 │  │
│  │                                                                  │  │
│  │   Provide trading signal with confidence level."                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│             │                                                         │
│             ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    GEMINI API CALL                              │  │
│  │                                                                  │  │
│  │  Model: gemini-1.5-pro / gemini-1.5-flash                       │  │
│  │  Temperature: 0.3 (low for consistency)                         │  │
│  │  Max tokens: 2048                                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│             │                                                         │
│             ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    RESPONSE PARSING                             │  │
│  │                                                                  │  │
│  │  {                                                               │  │
│  │    "signal": "BUY" | "SELL" | "HOLD",                           │  │
│  │    "confidence": 0-100,                                         │  │
│  │    "shortTermTarget": number,                                   │  │
│  │    "longTermTarget": number,                                    │  │
│  │    "stopLoss": number,                                          │  │
│  │    "technicalAnalysis": [...],                                  │  │
│  │    "fundamentalAnalysis": [...],                                │  │
│  │    "risks": [...],                                              │  │
│  │    "opportunities": [...],                                      │  │
│  │    "summary": "..."                                             │  │
│  │  }                                                               │  │
│  └────────────────────────────────────────────────────────────────┘  │
│             │                                                         │
│             ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    DISPLAY TO USER                              │  │
│  │                                                                  │  │
│  │  GeminiAnalysisWidget renders:                                  │  │
│  │  - Signal badge (BUY/SELL/HOLD with color)                     │  │
│  │  - Confidence meter                                             │  │
│  │  - Target prices                                                │  │
│  │  - Analysis breakdown                                           │  │
│  │  - Risk/Opportunity lists                                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
│             │                                                         │
│             ▼                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │               OPTIONAL: SAVE RECOMMENDATION                     │  │
│  │                                                                  │  │
│  │  If user saves → Firebase /buyRecommendations                   │  │
│  │  Track performance over time                                    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 15. SECURITY MEASURES

| Layer | Security Measure |
|-------|------------------|
| **Authentication** | Supabase Auth with JWT, PKCE for OAuth |
| **Authorization** | Role-based (user/mod/admin), Feature-based (free/premium) |
| **API Security** | Service Role Key server-side only, Anon Key for client |
| **Data Validation** | Input validation on all endpoints, OHLC data integrity checks |
| **CORS** | API proxy to bypass CORS for VNDirect |
| **Session** | Secure cookies, Token refresh, Device fingerprinting |
| **Rate Limiting** | Gemini usage limits (3 free / 20 premium per day) |

---

## 16. PERFORMANCE OPTIMIZATIONS

| Optimization | Implementation |
|--------------|----------------|
| **Code Splitting** | Dynamic imports for heavy components |
| **Image Optimization** | Next.js Image with multiple formats (WebP, AVIF) |
| **Caching** | SWR with 30s deduplication, localStorage for user prefs |
| **Compression** | gzip enabled, no source maps in production |
| **SSR/SSG** | Server-side rendering for SEO, dynamic for real-time data |
| **Database Indexing** | Profiles indexed on zalo_id, phone_number, nickname |
| **API Caching** | Revalidation strategy (3s for market data) |

---

## 17. DEPLOYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VERCEL PLATFORM                                  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    BUILD & DEPLOY                              │ │
│  │                                                                │ │
│  │  GitHub Push → Vercel CI/CD → Build → Deploy                  │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │ │
│  │  │   Static     │  │  Serverless  │  │    Edge      │        │ │
│  │  │   Assets     │  │  Functions   │  │   Runtime    │        │ │
│  │  │   (CDN)      │  │  (API)       │  │   (Fast)     │        │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────────────┐ │
│  │                    EXTERNAL SERVICES                           │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │ │
│  │  │   Supabase   │  │   Firebase   │  │   VNDirect   │        │ │
│  │  │  PostgreSQL  │  │   Realtime   │  │   Stock API  │        │ │
│  │  │    + Auth    │  │   Database   │  │              │        │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────┐                          │ │
│  │  │ Google Gemini│  │  Zalo OAuth  │                          │ │
│  │  │     AI       │  │              │                          │ │
│  │  └──────────────┘  └──────────────┘                          │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 18. SERVICES LAYER DETAILS

### auth.service.ts
```typescript
// Authentication methods
signUp(email, password)           // Email/password registration
signIn(email, password)           // Email/password login
signInWithPhone(phoneNumber)      // Phone number login
signInWithGoogle()                // Google OAuth
signInWithZalo()                  // Zalo OAuth
trackUserDevice()                 // Device fingerprinting
getSession()                      // Session retrieval with timeout
```

### profile.service.ts
```typescript
// Profile management
getProfile(userId)                // Fetch user profile
upsertProfile(profileData)        // Create/update profile
updateProfile(userId, updates)    // Partial profile updates
// Handles: nickname, avatar, stock account, membership
```

### recommendations.service.ts
```typescript
// AI recommendation tracking
getBuyRecommendations()           // Fetch AI buy recommendations
saveBuyRecommendation()           // Store new recommendation
updateRecommendationStatus()      // Track performance
calculatePerformanceMetrics()     // Win rate, gains, losses
// Uses: Firebase Realtime Database
```

### vndirect.ts
```typescript
// Stock data from VNDirect
fetchStockPrices(code, size)      // Historical price data
fetchFinancialRatios(code)        // P/E, P/B, ROE, ROA
fetchStockRecommendations(code)   // Analyst recommendations
// Features: Retry logic, OHLC validation
```

---

## 19. HOOKS LAYER DETAILS

| Hook | Purpose |
|------|---------|
| `usePermissions` | Access user permissions (auth, premium, role) |
| `useFeatureAccess` | Feature-level access control |
| `useGeminiUsageLimit` | Daily AI usage limits (3 free / 20 premium) |
| `useSession` | Current session information |
| `useUserProfile` | User profile data and updates |
| `useUnreadMessages` | Chat message notifications |

---

## 20. ENVIRONMENT VARIABLES

| Variable | Type | Purpose |
|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Server-only admin key |
| `GEMINI_API_KEY` | **Secret** | Google Gemini AI |
| `NEXT_PUBLIC_ZALO_APP_ID` | Public | Zalo OAuth app ID |
| `ZALO_APP_SECRET` | **Secret** | Zalo OAuth secret |
| `NEXT_PUBLIC_FIREBASE_*` | Public | Firebase configuration |

---

*Document generated: December 2024*
*Version: 2.0.0*
*Maintainer: CPLS Development Team*
