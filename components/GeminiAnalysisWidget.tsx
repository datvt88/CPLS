'use client'

/**
 * Gemini Analysis Widget - Main AI Analysis Component
 *
 * Role:
 * 1. Orchestrates the full analysis workflow
 * 2. Gets data from StockHubContext (central data hub)
 * 3. Calls /api/gemini/stock-analysis for AI analysis
 * 4. Displays results with visual indicators
 *
 * Data Flow:
 * StockHub (cached data) -> Widget (payload builder) -> API Route -> Display
 */

import { useState, useCallback, useEffect } from 'react'
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

// --- SUB-COMPONENTS ---

type StatusType = 'idle' | 'fetching' | 'processing' | 'ai_generating' | 'success' | 'error'

const StatusBadge = ({ status, message }: { status: StatusType, message: string }) => {
  const colorMap: Record<StatusType, string> = {
    idle: 'bg-slate-600',
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

const AnalysisCard = ({ title, data, colorClass }: { title: string, data: AnalysisSection, colorClass: string }) => {
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

      {/* Confidence Progress Bar */}
      <div className="w-full bg-gray-700/50 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${progressColors[data.signal] || 'bg-slate-500'}`}
          style={{ width: `${data.confidence}%` }}
        />
      </div>

      <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-3 italic flex-grow">
        "{data.summary}"
      </p>

      {/* Reasons List */}
      {data.reasons && data.reasons.length > 0 && (
        <div className="mt-auto pt-3 border-t border-white/5">
          <ul className="text-[10px] sm:text-xs text-gray-400 space-y-1">
            {data.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="opacity-50">-</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const ActionBox = ({ label, value, color }: { label: string, value: number | null | undefined, color: string }) => {
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
  symbol?: string // Optional fallback symbol
}

export default function GeminiAnalysisWidget({ symbol: propSymbol }: GeminiAnalysisWidgetProps) {
  const { isPremium, isAuthenticated, isLoading: authLoading } = usePermissions()

  // Access the centralized Stock Hub
  const stockHub = useStockHubOptional()

  // Resolve Symbol: Hub Priority > Prop > Default
  const symbol = stockHub?.currentSymbol ?? propSymbol ?? 'HPG'

  // Local UI State
  const [localStatus, setLocalStatus] = useState<StatusType>('idle')
  const [statusMsg, setStatusMsg] = useState('Sn sang')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if Hub has cached analysis for current symbol
  const hasAnalysis = stockHub?.geminiAnalysis && stockHub.stockData?.symbol === symbol

  // Sync status with Hub cache
  useEffect(() => {
    if (hasAnalysis) {
      setLocalStatus('success')
      setStatusMsg('Du lieu tu Hub')
    } else {
      setLocalStatus('idle')
      setStatusMsg('Sn sang')
    }
  }, [hasAnalysis, symbol])

  // --- MAIN ANALYSIS HANDLER ---
  const handleAnalyze = useCallback(async () => {
    if (!symbol || (!isPremium && !isAuthenticated)) return
    if (!stockHub) return

    setErrorMsg(null)

    try {
      // === PHASE 1: DATA GATHERING ===
      setLocalStatus('fetching')
      setStatusMsg('Dang tai du lieu...')

      let prices = stockHub.stockData?.prices
      let ratios = stockHub.stockData?.ratios
      let recs = stockHub.stockData?.recommendations
      let profitability = stockHub.stockData?.profitability

      // Check if we need to fetch data
      const needsPrices = !prices || prices.length < 30 || stockHub.isPricesStale()
      const needsRatios = !ratios || Object.keys(ratios).length === 0 || stockHub.isRatiosStale()
      const needsRecs = !recs || recs.length === 0 || stockHub.isRecommendationsStale()

      if (needsPrices || needsRatios || needsRecs) {
        setStatusMsg('Tai du lieu thi truong...')

        // Fetch in parallel
        const fetchPromises: Promise<any>[] = []

        if (needsPrices) {
          fetchPromises.push(fetchStockPricesClient(symbol, 200).then(res => ({ type: 'prices', data: res.data })))
        }
        if (needsRatios) {
          fetchPromises.push(fetchFinancialRatiosClient(symbol).then(res => ({ type: 'ratios', data: res.data })))
        }
        if (needsRecs) {
          fetchPromises.push(fetchRecommendationsClient(symbol).then(res => ({ type: 'recs', data: res.data })).catch(() => ({ type: 'recs', data: [] })))
        }

        // Always fetch profitability if not available
        if (!profitability) {
          fetchPromises.push(
            fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`)
              .then(r => r.json())
              .then(data => ({ type: 'profitability', data }))
              .catch(() => ({ type: 'profitability', data: null }))
          )
        }

        const results = await Promise.all(fetchPromises)

        // Process results and sync to Hub
        for (const result of results) {
          switch (result.type) {
            case 'prices':
              if (!result.data || result.data.length < 30) {
                throw new Error('Khong du du lieu gia de phan tich')
              }
              prices = result.data
              stockHub.setPrices(result.data)
              break
            case 'ratios':
              stockHub.setRatios(result.data || [])
              // Convert array to map for local use
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
        setStatusMsg('Su dung du lieu cached...')
      }

      // === PHASE 2: TECHNICAL CALCULATION ===
      setLocalStatus('processing')
      setStatusMsg('Tinh toan chi bao ky thuat...')

      const closePrices = prices!.map((d: StockPriceData) => d.adClose)
      const lastIdx = closePrices.length - 1
      const currentPrice = closePrices[lastIdx]
      const volumes = prices!.map((d: StockPriceData) => d.nmVolume)

      // Calculate indicators
      const ma10 = calculateSMA(closePrices, 10)[lastIdx]
      const ma30 = calculateSMA(closePrices, 30)[lastIdx]
      const bb = calculateBollingerBands(closePrices, 20, 2)
      const lastPriceData = prices![lastIdx]
      const pivotPoints = calculateWoodiePivotPoints(lastPriceData.adHigh, lastPriceData.adLow, lastPriceData.adClose)
      const momentum5d = lastIdx >= 5 ? ((currentPrice - closePrices[lastIdx - 5]) / closePrices[lastIdx - 5]) * 100 : 0

      // Build technical indicators object
      const technicalIndicators: TechnicalIndicators = {
        ma10,
        ma30,
        bollinger: bb ? {
          upper: bb.upper[lastIdx],
          middle: bb.middle[lastIdx],
          lower: bb.lower[lastIdx]
        } : null,
        pivotPoints: pivotPoints ? {
          pivot: pivotPoints.pivot,
          S1: pivotPoints.S1,
          S2: pivotPoints.S2,
          R1: pivotPoints.R1,
          R2: pivotPoints.R2,
          R3: pivotPoints.R3
        } : null,
        momentum5d
      }

      // Save to Hub for other widgets
      stockHub.setTechnicalIndicators(technicalIndicators)

      // Determine MA signal
      const maSignal = ma10 && ma30 ? (ma10 > ma30 ? 'Uptrend (MA10>MA30)' : 'Downtrend (MA10<MA30)') : 'N/A'

      // === PHASE 3: AI ANALYSIS ===
      setLocalStatus('ai_generating')
      setStatusMsg('Gemini dang phan tich...')

      // Build payload for API
      const payload = {
        symbol,
        technicalData: {
          currentPrice,
          buyPrice: pivotPoints?.S2,
          maSignal,
          ma10,
          ma30,
          bollinger: bb ? {
            upper: bb.upper[lastIdx],
            lower: bb.lower[lastIdx],
            middle: bb.middle[lastIdx]
          } : undefined,
          momentum: {
            day5: momentum5d,
          },
          volume: {
            current: volumes[lastIdx],
            avg10: volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
          }
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

      // Call API
      const res = await fetch('/api/gemini/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'full_context',
          data: payload
        })
      })

      if (!res.ok) {
        throw new Error('Khong the ket noi voi Gemini API')
      }

      const resultData: DeepAnalysisResult = await res.json()

      // === PHASE 4: COMPLETE ===
      stockHub.setGeminiAnalysis(resultData)
      setLocalStatus('success')
      setStatusMsg('Hoan tat')

    } catch (err: any) {
      console.error('[GeminiAnalysisWidget] Error:', err)
      setLocalStatus('error')
      setStatusMsg('Loi')
      setErrorMsg(err.message || 'Co loi xay ra')
    }
  }, [symbol, isPremium, isAuthenticated, stockHub])

  // --- RENDER ---

  if (authLoading) {
    return <div className="h-48 bg-[--panel] animate-pulse rounded-xl" />
  }

  // Premium Gate
  if (!isPremium) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-[--panel] p-8 text-center h-full flex flex-col justify-center items-center">
        <div className="absolute inset-0 bg-indigo-900/20 opacity-50" />
        <div className="relative z-10">
          <h3 className="text-xl font-bold text-white">Premium Only</h3>
          <p className="text-gray-400 my-4 text-sm">Mo khoa phan tich chuyen sau tu Gemini AI</p>
          <Link
            href="/pricing"
            className="bg-indigo-600 px-6 py-2 rounded-lg text-white font-bold text-sm hover:bg-indigo-500 transition-colors"
          >
            Nang cap ngay
          </Link>
        </div>
      </div>
    )
  }

  const result = stockHub?.geminiAnalysis

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] p-4 sm:p-5 shadow-2xl h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center mb-4 border-b border-indigo-500/20 pb-3 gap-2">
        <h3 className="text-lg sm:text-xl font-bold text-white flex gap-2 items-center">
          Deep Analysis
          {hasAnalysis && localStatus === 'success' && (
            <span className="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30">
              CACHED
            </span>
          )}
        </h3>

        <div className="flex items-center gap-2">
          <StatusBadge status={localStatus} message={statusMsg} />
          {(result || localStatus === 'error') && localStatus !== 'ai_generating' && (
            <button
              onClick={handleAnalyze}
              className="p-1.5 hover:bg-white/10 rounded-full text-indigo-400 transition-colors"
              title="Phan tich lai"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-grow flex flex-col">
        {/* Error State */}
        {localStatus === 'error' && (
          <div className="p-3 bg-rose-900/20 text-rose-300 rounded-lg text-center mb-4 border border-rose-500/20 text-sm">
            <p>! {errorMsg}</p>
            <button onClick={handleAnalyze} className="underline mt-1 font-semibold">Thu lai</button>
          </div>
        )}

        {/* Initial Empty State */}
        {!result && localStatus === 'idle' && (
          <div className="flex-grow flex flex-col items-center justify-center py-8 text-center">
            <div className="text-5xl mb-4">AI</div>
            <p className="text-gray-400 mb-6 text-sm max-w-xs">
              Ket hop du lieu Real-time & Tri tue nhan tao de dua ra nhan dinh.
            </p>
            <button
              onClick={handleAnalyze}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <span>*</span> Phan tich {symbol}
            </button>
          </div>
        )}

        {/* Loading State */}
        {(localStatus === 'fetching' || localStatus === 'processing' || localStatus === 'ai_generating') && !result && (
          <div className="flex-grow flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400 text-sm">{statusMsg}</p>
          </div>
        )}

        {/* Result Content */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Analysis Cards Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              <AnalysisCard
                title="Ky thuat (Ngan han)"
                data={result.shortTerm}
                colorClass="bg-slate-800/50 border-slate-700"
              />
              <AnalysisCard
                title="Co ban (Dai han)"
                data={result.longTerm}
                colorClass="bg-slate-800/50 border-slate-700"
              />
            </div>

            {/* Recommendation Box */}
            <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl">
              <div className="flex justify-between items-end mb-3">
                <h4 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                  KHUYEN NGHI
                </h4>
                <span className="text-[10px] text-gray-500">
                  Cap nhat: {new Date(result.timestamp || Date.now()).toLocaleTimeString('vi-VN')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <ActionBox label="Vung Mua" value={result.buyPrice} color="text-emerald-400" />
                <ActionBox label="Muc Tieu" value={result.targetPrice} color="text-blue-400" />
                <ActionBox label="Cat Lo" value={result.stopLoss} color="text-rose-400" />
              </div>
            </div>

            {/* Risk & Opportunity Footer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-300">
              {result.risks?.length > 0 && (
                <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-900/30">
                  <b className="text-rose-400 block mb-1">! Rui ro can luu y</b>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-200/80">
                    {result.risks.slice(0, 2).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {result.opportunities?.length > 0 && (
                <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-900/30">
                  <b className="text-emerald-400 block mb-1">^ Co hoi tiem nang</b>
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
