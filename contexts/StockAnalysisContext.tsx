'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import type { FinancialRatio, StockRecommendation, WoodiePivotPoints } from '@/types/vndirect'

// ============================================
// Type Definitions for Widget Data
// ============================================

// Technical Analysis Data (from StockDetailsWidget)
export interface TechnicalAnalysisData {
  currentPrice: number
  ma10: number | null
  ma30: number | null
  bollinger: {
    upper: number | null
    middle: number | null
    lower: number | null
  }
  pivotPoints: WoodiePivotPoints | null
  trend: 'bullish' | 'bearish' | 'neutral'
  priceChange: number
  priceChangePercent: number
  volume: number
  avgVolume10: number
  lastUpdated: string
}

// Financial Ratios Data (from StockFinancialsWidget)
export interface FinancialRatiosData {
  pe: number | null
  pb: number | null
  eps: number | null
  bvps: number | null
  roe: number | null
  roa: number | null
  beta: number | null
  dividendYield: number | null
  marketCap: number | null
  freeFloat: number | null
  high52Week: number | null
  low52Week: number | null
  avgVolume10D: number | null
  outstandingShares: number | null
  rawData: Record<string, FinancialRatio>
  lastUpdated: string
}

// Profitability Data (from StockProfitabilityWidget - ROE/ROA)
export interface ProfitabilityData {
  quarters: string[]
  metrics: Array<{
    id: number
    label: string
    values: number[]
    tooltip: string
  }>
  lastUpdated: string
}

// Profit Structure Data (from StockProfitStructureWidget)
export interface ProfitStructureData {
  quarters: string[]
  profitComponents: Array<{
    id: number
    label: string
    values: number[]
  }>
  equityComponents: Array<{
    id: number
    label: string
    values: number[]
  }> | null
  dataType: 'profit' | 'revenue'
  lastUpdated: string
}

// Recommendations Data (from StockRecommendationsWidget)
export interface RecommendationsData {
  recommendations: StockRecommendation[]
  stats: {
    buy: number
    hold: number
    sell: number
    total: number
  }
  avgTargetPrice: number | null
  lastUpdated: string
}

// Combined context state
interface StockAnalysisContextState {
  symbol: string
  technicalAnalysis: TechnicalAnalysisData | null
  financialRatios: FinancialRatiosData | null
  profitability: ProfitabilityData | null
  profitStructure: ProfitStructureData | null
  recommendations: RecommendationsData | null
}

// Context actions
interface StockAnalysisContextActions {
  setSymbol: (symbol: string) => void
  setTechnicalAnalysis: (data: TechnicalAnalysisData) => void
  setFinancialRatios: (data: FinancialRatiosData) => void
  setProfitability: (data: ProfitabilityData) => void
  setProfitStructure: (data: ProfitStructureData) => void
  setRecommendations: (data: RecommendationsData) => void
  clearAllData: () => void
  isDataReady: () => boolean
  getContextSummary: () => string
}

type StockAnalysisContextValue = StockAnalysisContextState & StockAnalysisContextActions

// ============================================
// Context Creation
// ============================================

const StockAnalysisContext = createContext<StockAnalysisContextValue | undefined>(undefined)

// Initial state
const initialState: StockAnalysisContextState = {
  symbol: '',
  technicalAnalysis: null,
  financialRatios: null,
  profitability: null,
  profitStructure: null,
  recommendations: null,
}

// ============================================
// Provider Component
// ============================================

interface StockAnalysisProviderProps {
  children: ReactNode
  initialSymbol?: string
}

export function StockAnalysisProvider({ children, initialSymbol = '' }: StockAnalysisProviderProps) {
  const [state, setState] = useState<StockAnalysisContextState>({
    ...initialState,
    symbol: initialSymbol,
  })

  // Action: Set symbol (also clears all data when symbol changes)
  const setSymbol = useCallback((symbol: string) => {
    setState(prev => {
      if (prev.symbol === symbol) return prev
      return {
        ...initialState,
        symbol,
      }
    })
  }, [])

  // Action: Set technical analysis data
  const setTechnicalAnalysis = useCallback((data: TechnicalAnalysisData) => {
    setState(prev => ({
      ...prev,
      technicalAnalysis: data,
    }))
  }, [])

  // Action: Set financial ratios data
  const setFinancialRatios = useCallback((data: FinancialRatiosData) => {
    setState(prev => ({
      ...prev,
      financialRatios: data,
    }))
  }, [])

  // Action: Set profitability data
  const setProfitability = useCallback((data: ProfitabilityData) => {
    setState(prev => ({
      ...prev,
      profitability: data,
    }))
  }, [])

  // Action: Set profit structure data
  const setProfitStructure = useCallback((data: ProfitStructureData) => {
    setState(prev => ({
      ...prev,
      profitStructure: data,
    }))
  }, [])

  // Action: Set recommendations data
  const setRecommendations = useCallback((data: RecommendationsData) => {
    setState(prev => ({
      ...prev,
      recommendations: data,
    }))
  }, [])

  // Action: Clear all data
  const clearAllData = useCallback(() => {
    setState(prev => ({
      ...initialState,
      symbol: prev.symbol,
    }))
  }, [])

  // Helper: Check if enough data is ready for Gemini analysis
  const isDataReady = useCallback(() => {
    // At least technical analysis OR financial ratios should be available
    return !!(state.technicalAnalysis || state.financialRatios)
  }, [state.technicalAnalysis, state.financialRatios])

  // Helper: Generate context summary for Gemini prompt
  const getContextSummary = useCallback(() => {
    const sections: string[] = []

    // Technical Analysis Summary
    if (state.technicalAnalysis) {
      const ta = state.technicalAnalysis
      sections.push(`
=== PHÂN TÍCH KỸ THUẬT NGẮN HẠN ===
- Giá hiện tại: ${ta.currentPrice?.toLocaleString('vi-VN')} VND
- MA10: ${ta.ma10?.toLocaleString('vi-VN') || 'N/A'} VND
- MA30: ${ta.ma30?.toLocaleString('vi-VN') || 'N/A'} VND
- Xu hướng ngắn hạn: ${ta.trend === 'bullish' ? 'TĂNG (MA10 > MA30)' : ta.trend === 'bearish' ? 'GIẢM (MA10 < MA30)' : 'TRUNG TÍNH'}
- Bollinger Bands: Trên=${ta.bollinger.upper?.toLocaleString('vi-VN') || 'N/A'}, Giữa=${ta.bollinger.middle?.toLocaleString('vi-VN') || 'N/A'}, Dưới=${ta.bollinger.lower?.toLocaleString('vi-VN') || 'N/A'}
- Pivot Points: Buy T+=${ta.pivotPoints?.S2?.toLocaleString('vi-VN') || 'N/A'}, Sell T+=${ta.pivotPoints?.R3?.toLocaleString('vi-VN') || 'N/A'}
- Thay đổi giá: ${ta.priceChange >= 0 ? '+' : ''}${ta.priceChange?.toLocaleString('vi-VN')} (${ta.priceChangePercent >= 0 ? '+' : ''}${ta.priceChangePercent?.toFixed(2)}%)
- Khối lượng: ${ta.volume?.toLocaleString('vi-VN')} (TB 10 ngày: ${ta.avgVolume10?.toLocaleString('vi-VN')})
`)
    }

    // Financial Ratios Summary
    if (state.financialRatios) {
      const fr = state.financialRatios
      sections.push(`
=== CHỈ SỐ TÀI CHÍNH ===
- P/E: ${fr.pe?.toFixed(2) || 'N/A'}
- P/B: ${fr.pb?.toFixed(2) || 'N/A'}
- EPS: ${fr.eps?.toLocaleString('vi-VN') || 'N/A'} VND
- BVPS: ${fr.bvps?.toLocaleString('vi-VN') || 'N/A'} VND
- ROE (TB 5 quý): ${fr.roe?.toFixed(2) || 'N/A'}%
- ROA (TB 5 quý): ${fr.roa?.toFixed(2) || 'N/A'}%
- Beta: ${fr.beta?.toFixed(2) || 'N/A'}
- Tỷ suất cổ tức: ${fr.dividendYield?.toFixed(2) || 'N/A'}%
- Vốn hóa: ${fr.marketCap ? (fr.marketCap / 1e12).toFixed(2) + ' nghìn tỷ VND' : 'N/A'}
- Free Float: ${fr.freeFloat?.toFixed(2) || 'N/A'}%
- Giá 52 tuần: Cao=${fr.high52Week?.toLocaleString('vi-VN') || 'N/A'}, Thấp=${fr.low52Week?.toLocaleString('vi-VN') || 'N/A'}
`)
    }

    // Profitability Summary (ROE/ROA by quarter)
    if (state.profitability && state.profitability.metrics.length > 0) {
      const prof = state.profitability
      sections.push(`
=== HIỆU QUẢ HOẠT ĐỘNG (5 QUÝ GẦN NHẤT) ===
Các quý: ${prof.quarters.join(', ')}
${prof.metrics.map(m => `- ${m.label}: ${m.values.map(v => v.toFixed(2) + '%').join(' | ')}`).join('\n')}
`)
    }

    // Profit Structure Summary
    if (state.profitStructure) {
      const ps = state.profitStructure
      sections.push(`
=== CƠ CẤU ${ps.dataType === 'profit' ? 'LỢI NHUẬN' : 'DOANH THU'} (5 QUÝ GẦN NHẤT) ===
Các quý: ${ps.quarters.join(', ')}
${ps.profitComponents.map(c => `- ${c.label}: ${c.values.map(v => (v / 1e12).toFixed(2) + ' nghìn tỷ').join(' | ')}`).join('\n')}
${ps.equityComponents ? `
=== CƠ CẤU VỐN CHỦ SỞ HỮU ===
${ps.equityComponents.map(c => `- ${c.label}: ${c.values.map(v => (v / 1e12).toFixed(2) + ' nghìn tỷ').join(' | ')}`).join('\n')}
` : ''}
`)
    }

    // Recommendations Summary
    if (state.recommendations && state.recommendations.recommendations.length > 0) {
      const rec = state.recommendations
      const buyPercent = rec.stats.total > 0 ? ((rec.stats.buy / rec.stats.total) * 100).toFixed(0) : '0'
      const holdPercent = rec.stats.total > 0 ? ((rec.stats.hold / rec.stats.total) * 100).toFixed(0) : '0'
      const sellPercent = rec.stats.total > 0 ? ((rec.stats.sell / rec.stats.total) * 100).toFixed(0) : '0'

      sections.push(`
=== ĐÁNH GIÁ TỪ CÁC CÔNG TY CHỨNG KHOÁN (12 THÁNG) ===
- Tổng số đánh giá: ${rec.stats.total}
- MUA: ${rec.stats.buy} (${buyPercent}%)
- NẮM GIỮ: ${rec.stats.hold} (${holdPercent}%)
- BÁN: ${rec.stats.sell} (${sellPercent}%)
- Giá mục tiêu trung bình: ${rec.avgTargetPrice?.toLocaleString('vi-VN') || 'N/A'} VND

Các đánh giá gần đây:
${rec.recommendations.slice(0, 5).map(r => `- ${r.firm}: ${r.type} | Giá MT: ${r.targetPrice?.toLocaleString('vi-VN')} VND | Ngày: ${new Date(r.reportDate).toLocaleDateString('vi-VN')}`).join('\n')}
`)
    }

    if (sections.length === 0) {
      return 'Chưa có dữ liệu từ các widget khác.'
    }

    return `
========================================
DỮ LIỆU TỪ CÁC WIDGET PHÂN TÍCH - ${state.symbol}
========================================
${sections.join('\n')}
========================================
`
  }, [state])

  // Memoize context value
  const value = useMemo<StockAnalysisContextValue>(() => ({
    ...state,
    setSymbol,
    setTechnicalAnalysis,
    setFinancialRatios,
    setProfitability,
    setProfitStructure,
    setRecommendations,
    clearAllData,
    isDataReady,
    getContextSummary,
  }), [
    state,
    setSymbol,
    setTechnicalAnalysis,
    setFinancialRatios,
    setProfitability,
    setProfitStructure,
    setRecommendations,
    clearAllData,
    isDataReady,
    getContextSummary,
  ])

  return (
    <StockAnalysisContext.Provider value={value}>
      {children}
    </StockAnalysisContext.Provider>
  )
}

// ============================================
// Custom Hook
// ============================================

export function useStockAnalysis() {
  const context = useContext(StockAnalysisContext)
  if (context === undefined) {
    throw new Error('useStockAnalysis must be used within a StockAnalysisProvider')
  }
  return context
}

// Optional hook for safe usage outside provider
export function useStockAnalysisSafe() {
  return useContext(StockAnalysisContext)
}
