'use client'

/**
 * Gemini Analysis Widget - Main AI Analysis Component
 *
 * Features:
 * 1. Shows API connection status
 * 2. Shows data readiness from StockHub
 * 3. Orchestrates full analysis workflow
 * 4. Displays results with visual indicators
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'

// Services & Utils
import { fetchStockPricesClient, fetchFinancialRatiosClient, fetchRecommendationsClient } from '@/services/vndirect-client'
import { calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import { formatPrice } from '@/utils/formatters'

// Contexts & Types
import { usePermissions } from '@/contexts/PermissionsContext'
import { useStockHubOptional, type TechnicalIndicators } from '@/contexts/StockHubContext'
import type { StockPriceData } from '@/types/vndirect'
import type { DeepAnalysisResult, AnalysisSection } from '@/lib/gemini/types'

// --- TYPES ---
type StatusType = 'idle' | 'checking' | 'fetching' | 'processing' | 'ai_generating' | 'success' | 'error'

interface APIStatus {
  checked: boolean
  ready: boolean
  message: string
}

interface DataStatus {
  prices: boolean
  ratios: boolean
  recommendations: boolean
  technical: boolean
}

// --- STATUS COMPONENTS ---

const StatusIndicator = ({ ready, label }: { ready: boolean; label: string }) => (
  <div className="flex items-center gap-1.5 text-[10px]">
    <span className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-emerald-500' : 'bg-slate-500'}`} />
    <span className={ready ? 'text-emerald-400' : 'text-slate-500'}>{label}</span>
  </div>
)

const StatusBadge = ({ status, message }: { status: StatusType; message: string }) => {
  const colorMap: Record<StatusType, string> = {
    idle: 'bg-slate-600',
    checking: 'bg-blue-500 animate-pulse',
    fetching: 'bg-yellow-500 animate-pulse',
    processing: 'bg-blue-500 animate-pulse',
    ai_generating: 'bg-purple-500 animate-pulse',
    success: 'bg-emerald-500',
    error: 'bg-rose-500'
  }

  return (
    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium bg-slate-800/80 px-2 sm:px-3 py-1 rounded-full border border-slate-700 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${colorMap[status]}`} />
      <span className="text-slate-300">{message}</span>
    </div>
  )
}

// --- ANALYSIS DISPLAY COMPONENTS ---

const AnalysisCard = ({ title, data, colorClass }: { title: string; data: AnalysisSection; colorClass: string }) => {
  if (!data) return null

  const signalColors: Record<string, string> = {
    'MUA': 'bg-emerald-600',
    'BÁN': 'bg-rose-600',
    'THEO DÕI': 'bg-amber-600'
  }

  const progressColors: Record<string, string> = {
    'MUA': 'bg-emerald-500',
    'BÁN': 'bg-rose-500',
    'THEO DÕI': 'bg-amber-500'
  }

  return (
    <div className={`rounded-xl p-4 border bg-opacity-20 flex flex-col h-full ${colorClass}`}>
      <div className="flex justify-between mb-3 items-center">
        <h4 className="font-semibold text-white text-sm sm:text-base">{title}</h4>
        <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${signalColors[data.signal] || 'bg-slate-600'}`}>
          {data.signal}
        </span>
      </div>

      <div className="w-full bg-gray-700/50 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${progressColors[data.signal] || 'bg-slate-500'}`}
          style={{ width: `${data.confidence}%` }}
        />
      </div>

      <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-3 italic flex-grow">
        "{data.summary}"
      </p>

      {data.reasons && data.reasons.length > 0 && (
        <div className="mt-auto pt-3 border-t border-white/5">
          <ul className="text-[10px] sm:text-xs text-gray-400 space-y-1">
            {data.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="opacity-50">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const ActionBox = ({ label, value, color }: { label: string; value: number | null | undefined; color: string }) => {
  if (!value) return null
  return (
    <div className="rounded-lg bg-slate-900/50 p-2 sm:p-3 text-center border border-slate-700">
      <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">{label}</div>
      <div className={`text-base sm:text-lg font-bold ${color}`}>{formatPrice(value)}</div>
    </div>
  )
}

// --- MAIN COMPONENT ---

interface GeminiAnalysisWidgetProps {
  symbol?: string
}

export default function GeminiAnalysisWidget({ symbol: propSymbol }: GeminiAnalysisWidgetProps) {
  const { isPremium, isAuthenticated, isLoading: authLoading } = usePermissions()
  const stockHub = useStockHubOptional()

  // Resolve Symbol
  const symbol = stockHub?.currentSymbol ?? propSymbol ?? 'HPG'

  // API Status
  const [apiStatus, setApiStatus] = useState<APIStatus>({
    checked: false,
    ready: false,
    message: 'Đang kiểm tra...'
  })

  // Local UI State
  const [localStatus, setLocalStatus] = useState<StatusType>('idle')
  const [statusMsg, setStatusMsg] = useState('Sẵn sàng')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Data readiness from StockHub
  const dataStatus = useMemo<DataStatus>(() => {
    if (!stockHub?.stockData) {
      return { prices: false, ratios: false, recommendations: false, technical: false }
    }
    const sd = stockHub.stockData
    return {
      prices: sd.prices.length >= 30,
      ratios: Object.keys(sd.ratios).length > 0,
      recommendations: sd.recommendations.length > 0,
      technical: sd.technicalIndicators !== null
    }
  }, [stockHub?.stockData])

  const isDataReady = dataStatus.prices && dataStatus.ratios

  // Check if Hub has cached analysis
  const hasAnalysis = stockHub?.geminiAnalysis && stockHub.stockData?.symbol === symbol

  // --- CHECK API STATUS ON MOUNT ---
  useEffect(() => {
    const checkAPI = async () => {
      try {
        const res = await fetch('/api/gemini/stock-analysis', { method: 'GET' })
        const data = await res.json()
        setApiStatus({
          checked: true,
          ready: data.ready === true,
          message: data.ready ? 'API sẵn sàng' : (data.message || 'API chưa sẵn sàng')
        })
      } catch (err) {
        setApiStatus({
          checked: true,
          ready: false,
          message: 'Không thể kiểm tra API'
        })
      }
    }
    checkAPI()
  }, [])

  // --- SYNC STATUS WITH CACHE ---
  useEffect(() => {
    if (hasAnalysis) {
      setLocalStatus('success')
      setStatusMsg('Dữ liệu từ cache')
    }
    // Don't reset to idle when hasAnalysis becomes false
    // This prevents the widget from closing when user switches apps
  }, [hasAnalysis])

  // --- RESET WHEN SYMBOL CHANGES ---
  useEffect(() => {
    // Reset status when symbol changes (user selects different stock)
    setLocalStatus('idle')
    setStatusMsg('Sẵn sàng')
    setErrorMsg(null)
  }, [symbol])

  // --- MAIN ANALYSIS HANDLER ---
  const handleAnalyze = useCallback(async () => {
    if (!symbol || (!isPremium && !isAuthenticated)) return
    if (!stockHub) return

    // Check API first
    if (!apiStatus.ready) {
      setErrorMsg('Gemini API chưa sẵn sàng. Vui lòng thử lại sau.')
      setLocalStatus('error')
      return
    }

    setErrorMsg(null)

    try {
      // === PHASE 1: DATA GATHERING ===
      setLocalStatus('fetching')
      setStatusMsg('Đang tải dữ liệu...')

      let prices = stockHub.stockData?.prices
      let ratios = stockHub.stockData?.ratios
      let recs = stockHub.stockData?.recommendations
      let profitability = stockHub.stockData?.profitability

      const needsPrices = !prices || prices.length < 30
      const needsRatios = !ratios || Object.keys(ratios).length === 0
      const needsRecs = !recs || recs.length === 0

      if (needsPrices || needsRatios || needsRecs) {
        setStatusMsg('Tải dữ liệu thị trường...')

        const fetchPromises: Promise<any>[] = []

        if (needsPrices) {
          fetchPromises.push(
            fetchStockPricesClient(symbol, 200)
              .then(res => ({ type: 'prices', data: res.data }))
              .catch(() => ({ type: 'prices', data: null }))
          )
        }
        if (needsRatios) {
          fetchPromises.push(
            fetchFinancialRatiosClient(symbol)
              .then(res => ({ type: 'ratios', data: res.data }))
              .catch(() => ({ type: 'ratios', data: [] }))
          )
        }
        if (needsRecs) {
          fetchPromises.push(
            fetchRecommendationsClient(symbol)
              .then(res => ({ type: 'recs', data: res.data }))
              .catch(() => ({ type: 'recs', data: [] }))
          )
        }
        if (!profitability) {
          fetchPromises.push(
            fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`)
              .then(r => r.json())
              .then(data => ({ type: 'profitability', data }))
              .catch(() => ({ type: 'profitability', data: null }))
          )
        }

        const results = await Promise.all(fetchPromises)

        for (const result of results) {
          switch (result.type) {
            case 'prices':
              if (!result.data || result.data.length < 30) {
                throw new Error('Không đủ dữ liệu giá để phân tích (cần ít nhất 30 phiên)')
              }
              prices = result.data
              stockHub.setPrices(result.data)
              break
            case 'ratios':
              stockHub.setRatios(result.data || [])
              const ratiosMap: any = {}
              result.data?.forEach((r: any) => ratiosMap[r.ratioCode] = r)
              ratios = ratiosMap
              break
            case 'recs':
              recs = result.data
              stockHub.setRecommendations(result.data || [])
              break
            case 'profitability':
              profitability = result.data
              stockHub.setProfitability(result.data)
              break
          }
        }
      } else {
        setStatusMsg('Sử dụng dữ liệu đã cache...')
      }

      // === PHASE 2: TECHNICAL CALCULATION ===
      setLocalStatus('processing')
      setStatusMsg('Tính toán chỉ báo kỹ thuật...')

      const closePrices = prices!.map((d: StockPriceData) => d.adClose)
      const lastIdx = closePrices.length - 1
      const currentPrice = closePrices[lastIdx]
      const volumes = prices!.map((d: StockPriceData) => d.nmVolume)

      const ma10 = calculateSMA(closePrices, 10)[lastIdx]
      const ma30 = calculateSMA(closePrices, 30)[lastIdx]
      const bb = calculateBollingerBands(closePrices, 20, 2)
      const lastPriceData = prices![lastIdx]
      const pivotPoints = calculateWoodiePivotPoints(lastPriceData.adHigh, lastPriceData.adLow, lastPriceData.adClose)
      const momentum5d = lastIdx >= 5 ? ((currentPrice - closePrices[lastIdx - 5]) / closePrices[lastIdx - 5]) * 100 : 0

      const technicalIndicators: TechnicalIndicators = {
        ma10,
        ma30,
        bollinger: bb ? { upper: bb.upper[lastIdx], middle: bb.middle[lastIdx], lower: bb.lower[lastIdx] } : null,
        pivotPoints: pivotPoints ? { pivot: pivotPoints.pivot, S1: pivotPoints.S1, S2: pivotPoints.S2, R1: pivotPoints.R1, R2: pivotPoints.R2, R3: pivotPoints.R3 } : null,
        momentum5d
      }

      stockHub.setTechnicalIndicators(technicalIndicators)

      const maSignal = ma10 && ma30 ? (ma10 > ma30 ? 'Uptrend (MA10>MA30)' : 'Downtrend (MA10<MA30)') : 'N/A'

      // === PHASE 3: AI ANALYSIS ===
      setLocalStatus('ai_generating')
      setStatusMsg('Gemini đang phân tích...')

      const payload = {
        symbol,
        technicalData: {
          currentPrice,
          buyPrice: pivotPoints?.S2,
          maSignal,
          ma10,
          ma30,
          bollinger: bb ? { upper: bb.upper[lastIdx], lower: bb.lower[lastIdx], middle: bb.middle[lastIdx] } : undefined,
          momentum: { day5: momentum5d },
          volume: { current: volumes[lastIdx], avg10: volumes.slice(-10).reduce((a, b) => a + b, 0) / 10 }
        },
        fundamentalData: {
          pe: (ratios as any)?.['PRICE_TO_EARNINGS']?.value,
          pb: (ratios as any)?.['PRICE_TO_BOOK']?.value,
          roe: (ratios as any)?.['ROAE_TR_AVG5Q']?.value ? (ratios as any)['ROAE_TR_AVG5Q'].value * 100 : undefined,
          roa: (ratios as any)?.['ROAA_TR_AVG5Q']?.value ? (ratios as any)['ROAA_TR_AVG5Q'].value * 100 : undefined,
          profitability
        },
        recommendations: recs?.slice(0, 5) || []
      }

      const res = await fetch('/api/gemini/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'full_context', data: payload })
      })

      const resultData = await res.json()

      if (!res.ok) {
        throw new Error(resultData.error || 'Không thể kết nối với Gemini API')
      }

      // === PHASE 4: COMPLETE ===
      stockHub.setGeminiAnalysis(resultData as DeepAnalysisResult)
      setLocalStatus('success')
      setStatusMsg('Hoàn tất')

    } catch (err: any) {
      console.error('[GeminiAnalysisWidget] Error:', err)
      setLocalStatus('error')
      setStatusMsg('Lỗi')
      setErrorMsg(err.message || 'Có lỗi xảy ra')
    }
  }, [symbol, isPremium, isAuthenticated, stockHub, apiStatus.ready])

  // --- RENDER ---

  if (authLoading) {
    return <div className="h-48 bg-[--panel] animate-pulse rounded-xl" />
  }

  if (!isPremium) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-[--panel] p-8 text-center h-full flex flex-col justify-center items-center">
        <div className="absolute inset-0 bg-indigo-900/20 opacity-50" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white">Premium Only</h3>
          <p className="text-gray-400 my-4 text-sm">Mở khóa phân tích chuyên sâu từ Gemini AI</p>
          <Link href="/pricing" className="bg-indigo-600 px-6 py-2 rounded-lg text-white font-bold text-sm hover:bg-indigo-500 transition-colors">
            Nâng cấp ngay
          </Link>
        </div>
      </div>
    )
  }

  const result = stockHub?.geminiAnalysis

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] p-4 sm:p-5 shadow-2xl h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center mb-3 border-b border-indigo-500/20 pb-3 gap-2">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white flex gap-2 items-center">
            🤖 Deep Analysis
            {hasAnalysis && localStatus === 'success' && (
              <span className="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30">
                CACHED
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={localStatus} message={statusMsg} />
          {(result || localStatus === 'error') && localStatus !== 'ai_generating' && (
            <button
              onClick={handleAnalyze}
              className="p-1.5 hover:bg-white/10 rounded-full text-indigo-400 transition-colors"
              title="Phân tích lại"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* STATUS PANEL */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 pb-3 border-b border-slate-700/50">
        <StatusIndicator ready={apiStatus.ready} label={apiStatus.checked ? (apiStatus.ready ? 'API OK' : 'API lỗi') : 'Đang kiểm tra API...'} />
        <StatusIndicator ready={dataStatus.prices} label={`Giá ${dataStatus.prices ? '✓' : '○'}`} />
        <StatusIndicator ready={dataStatus.ratios} label={`Chỉ số ${dataStatus.ratios ? '✓' : '○'}`} />
        <StatusIndicator ready={dataStatus.technical} label={`Kỹ thuật ${dataStatus.technical ? '✓' : '○'}`} />
        <StatusIndicator ready={dataStatus.recommendations} label={`CTCK ${dataStatus.recommendations ? '✓' : '○'}`} />
      </div>

      {/* BODY */}
      <div className="flex-grow flex flex-col">
        {/* Error State */}
        {localStatus === 'error' && (
          <div className="p-3 bg-rose-900/20 text-rose-300 rounded-lg text-center mb-4 border border-rose-500/20 text-sm">
            <p>⚠️ {errorMsg}</p>
            <button onClick={handleAnalyze} className="underline mt-1 font-semibold">Thử lại</button>
          </div>
        )}

        {/* Initial Empty State */}
        {!result && localStatus === 'idle' && (
          <div className="flex-grow flex flex-col items-center justify-center py-6 text-center">
            <div className="text-4xl mb-3">💎</div>
            <p className="text-gray-400 mb-4 text-sm max-w-xs">
              Kết hợp dữ liệu Real-time & Trí tuệ nhân tạo để đưa ra nhận định.
            </p>

            {!apiStatus.ready && apiStatus.checked && (
              <p className="text-amber-400 text-xs mb-3">⚠️ {apiStatus.message}</p>
            )}

            {!isDataReady && (
              <p className="text-slate-400 text-xs mb-3">
                📊 Đang chờ dữ liệu từ các widget khác...
              </p>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!apiStatus.ready}
              className={`px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2
                ${apiStatus.ready
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/30 hover:scale-105 active:scale-95'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
            >
              <span>✨</span> Phân tích {symbol}
            </button>
          </div>
        )}

        {/* Loading State */}
        {(localStatus === 'checking' || localStatus === 'fetching' || localStatus === 'processing' || localStatus === 'ai_generating') && !result && (
          <div className="flex-grow flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400 text-sm">{statusMsg}</p>
          </div>
        )}

        {/* Result Content */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid md:grid-cols-2 gap-4">
              <AnalysisCard title="⚡ Kỹ thuật (Ngắn hạn)" data={result.shortTerm} colorClass="bg-slate-800/50 border-slate-700" />
              <AnalysisCard title="📊 Cơ bản (Dài hạn)" data={result.longTerm} colorClass="bg-slate-800/50 border-slate-700" />
            </div>

            <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl">
              <div className="flex justify-between items-end mb-3">
                <h4 className="text-emerald-400 font-bold text-sm flex items-center gap-2">🎯 KHUYẾN NGHỊ</h4>
                <span className="text-[10px] text-gray-500">
                  Cập nhật: {new Date(result.timestamp || Date.now()).toLocaleTimeString('vi-VN')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <ActionBox label="Vùng Mua" value={result.buyPrice} color="text-emerald-400" />
                <ActionBox label="Mục Tiêu" value={result.targetPrice} color="text-violet-400" />
                <ActionBox label="Cắt Lỗ" value={result.stopLoss} color="text-rose-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-300">
              {result.risks?.length > 0 && (
                <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-900/30">
                  <b className="text-rose-400 block mb-1">⚠️ Rủi ro cần lưu ý</b>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-200/80">
                    {result.risks.slice(0, 2).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {result.opportunities?.length > 0 && (
                <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-900/30">
                  <b className="text-emerald-400 block mb-1">🚀 Cơ hội tiềm năng</b>
                  <ul className="list-disc list-inside space-y-0.5 text-emerald-200/80">
                    {result.opportunities.slice(0, 2).map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
