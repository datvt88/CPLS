'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'

// Services & Utils
import { fetchStockPricesClient, fetchFinancialRatiosClient, fetchRecommendationsClient } from '@/services/vndirect-client'
import { calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import { formatPrice } from '@/utils/formatters'

// Contexts & Types
import { usePermissions } from '@/contexts/PermissionsContext'
import { useStockHubOptional } from '@/contexts/StockHubContext'
import type { StockPriceData } from '@/types/vndirect'
import type { DeepAnalysisResult, AnalysisSection } from '@/lib/gemini/types'

// --- SUB-COMPONENTS ---

const StatusBadge = ({ status, message }: { status: string, message: string }) => {
  const getColor = () => {
    switch (status) {
      case 'fetching': return 'bg-yellow-500 animate-pulse'
      case 'processing': return 'bg-blue-500 animate-pulse'
      case 'ai_generating': return 'bg-purple-500 animate-pulse'
      case 'success': return 'bg-emerald-500'
      case 'error': return 'bg-rose-500'
      default: return 'bg-slate-600'
    }
  }

  return (
    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium bg-slate-800/80 px-2 sm:px-3 py-1 rounded-full border border-slate-700 whitespace-nowrap">
      <span className={`h-2 w-2 rounded-full ${getColor()}`}></span>
      <span className="text-slate-300">{message}</span>
    </div>
  )
}

const AnalysisCard = ({ title, data, colorClass }: { title: string, data: AnalysisSection, colorClass: string }) => {
  if (!data) return null
  return (
    <div className={`rounded-xl p-4 border bg-opacity-20 flex flex-col h-full ${colorClass}`}>
      <div className="flex justify-between mb-3 items-center">
        <h4 className="font-semibold text-white text-sm sm:text-base">{title}</h4>
        <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold ${
          data.signal === 'MUA' ? 'bg-emerald-600' : 
          data.signal === 'BÁN' ? 'bg-rose-600' : 'bg-amber-600'
        }`}>
          {data.signal}
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-gray-700/50 rounded-full h-1.5 mb-3 overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${
            data.signal === 'MUA' ? 'bg-emerald-500' : 
            data.signal === 'BÁN' ? 'bg-rose-500' : 'bg-amber-500'
          }`} 
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
  symbol?: string // Optional fallback
}

export default function GeminiAnalysisWidget({ symbol: propSymbol }: GeminiAnalysisWidgetProps) {
  const { isPremium, isAuthenticated, isLoading: authLoading } = usePermissions()
  
  // Access the centralized HUB
  const stockHub = useStockHubOptional()

  // Resolve Symbol: Hub Priority > Prop > Default
  const symbol = stockHub?.currentSymbol ?? propSymbol ?? 'HPG'

  // Local UI State
  const [localStatus, setLocalStatus] = useState<'idle' | 'fetching' | 'processing' | 'ai_generating' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('Sẵn sàng')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Sync state with Hub result
  // If Hub has analysis for CURRENT symbol, show it immediately
  const hasAnalysis = stockHub?.geminiAnalysis && stockHub.stockData?.symbol === symbol
  
  useEffect(() => {
    if (hasAnalysis) {
      setLocalStatus('success')
      setStatusMsg('Dữ liệu từ Hub')
    } else {
      setLocalStatus('idle')
      setStatusMsg('Sẵn sàng')
    }
  }, [hasAnalysis, symbol])

  const handleAnalyze = useCallback(async () => {
    if (!symbol || (!isPremium && !isAuthenticated)) return
    if (!stockHub) return // Should not happen if wrapped correctly

    setErrorMsg(null)

    try {
      // 1. DATA GATHERING (Check Cache First)
      setLocalStatus('fetching')
      let prices = stockHub.stockData?.prices
      let ratios = stockHub.stockData?.ratios
      let recs = stockHub.stockData?.recommendations
      let profitability = stockHub.stockData?.profitability

      const isDataMissing = !prices || prices.length < 30 || !ratios || Object.keys(ratios).length === 0

      if (isDataMissing) {
        setStatusMsg('Đang tải dữ liệu thị trường...')
        // Fetch Parallel
        const [pricesRes, ratiosRes, recsRes, profRes] = await Promise.all([
          fetchStockPricesClient(symbol, 200),
          fetchFinancialRatiosClient(symbol),
          fetchRecommendationsClient(symbol).catch(() => ({ data: [] })),
          fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`).then(r => r.json()).catch(() => null)
        ])

        if (!pricesRes.data || pricesRes.data.length < 30) throw new Error('Không đủ dữ liệu giá để phân tích')

        // Update Local Vars
        prices = pricesRes.data
        // Note: ratiosRes is array, stockData.ratios is Map. We pass array to setter.
        
        // SYNC TO HUB (Reverse Sync)
        stockHub.setPrices(pricesRes.data)
        stockHub.setRatios(ratiosRes.data)
        stockHub.setRecommendations(recsRes.data || [])
        stockHub.setProfitability(profRes)
        
        // Refresh local refs for calculation
        // Need to manually map ratios for local usage immediately since state update might be async
        const ratiosMap: any = {}
        ratiosRes.data.forEach((r: any) => ratiosMap[r.ratioCode] = r)
        ratios = ratiosMap
        recs = recsRes.data
        profitability = profRes
      } else {
        setStatusMsg('Sử dụng dữ liệu Hub...')
      }

      // 2. PROCESSING (Local Calculation)
      setLocalStatus('processing')
      setStatusMsg('Tính toán chỉ báo...')
      
      // Calculate Indicators locally to ensure latest data
      // (Even if Hub has them, recalculating is cheap and ensures consistency for the AI payload)
      const closePrices = prices!.map((d: StockPriceData) => d.adClose)
      const lastIdx = closePrices.length - 1
      const currentPrice = closePrices[lastIdx]
      const volumes = prices!.map((d: StockPriceData) => d.nmVolume)

      const ma10 = calculateSMA(closePrices, 10)[lastIdx]
      const ma30 = calculateSMA(closePrices, 30)[lastIdx]
      const bb = calculateBollingerBands(closePrices, 20, 2)
      const lastPriceData = prices![lastIdx]
      const pivotPoints = calculateWoodiePivotPoints(lastPriceData.adHigh, lastPriceData.adLow, lastPriceData.adClose)
      
      // Save computed indicators to Hub for other widgets (Chart, etc.)
      stockHub.setTechnicalIndicators({
        ma10, ma30,
        bollinger: { upper: bb.upper[lastIdx], middle: bb.middle[lastIdx], lower: bb.lower[lastIdx] },
        pivotPoints: pivotPoints ? { S2: pivotPoints.S2, R3: pivotPoints.R3, pivot: pivotPoints.pivot } : null,
        momentum5d: closePrices.length > 5 ? ((currentPrice - closePrices[lastIdx-5])/closePrices[lastIdx-5])*100 : 0
      })

      // Rule-based pre-check for AI context
      const maSignal = ma10 && ma30 ? (ma10 > ma30 ? 'Uptrend (MA10>MA30)' : 'Downtrend (MA10<MA30)') : 'N/A'

      // 3. AI GENERATION
      setLocalStatus('ai_generating')
      setStatusMsg('Gemini đang phân tích...')

      // Payload Construction (Matches Hub Interface)
      const payload = {
        symbol,
        technicalData: {
            currentPrice,
            buyPrice: pivotPoints?.S2,
            maSignal,
            ma10, ma30,
            bollinger: { 
                upper: bb?.upper[lastIdx], 
                lower: bb?.lower[lastIdx] 
            },
            momentum: {
                day5: closePrices.length > 5 ? (currentPrice - closePrices[lastIdx-5])/closePrices[lastIdx-5] : 0,
            },
            volume: { current: volumes[lastIdx], avg10: volumes.slice(-10).reduce((a,b)=>a+b,0)/10 }
        },
        fundamentalData: {
            // Safe access for ratios (check if ratios is Map or Array logic depending on where it came from)
            // StockHubContext stores as Record<string, Ratio>.
            pe: (ratios as any)['PRICE_TO_EARNINGS']?.value,
            pb: (ratios as any)['PRICE_TO_BOOK']?.value,
            roe: (ratios as any)['ROAE_TR_AVG5Q']?.value * 100,
            roa: (ratios as any)['ROAA_TR_AVG5Q']?.value * 100,
            profitability
        },
        recommendations: recs?.slice(0, 5) || []
      }

      // API Call
      const res = await fetch('/api/gemini/stock-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
             type: 'full_context',
             data: payload
        })
      })

      if (!res.ok) throw new Error('Không thể kết nối với Gemini Hub')
      const resultData: DeepAnalysisResult = await res.json()

      // 4. FINISH
      stockHub.setGeminiAnalysis(resultData)
      setLocalStatus('success')
      setStatusMsg('Hoàn tất')

    } catch (err: any) {
      console.error(err)
      setLocalStatus('error')
      setStatusMsg('Lỗi')
      setErrorMsg(err.message || 'Có lỗi xảy ra')
    }
  }, [symbol, isPremium, isAuthenticated, stockHub])

  // --- RENDER ---
  
  if (authLoading) return <div className="h-48 bg-[--panel] animate-pulse rounded-xl" />

  if (!isPremium) return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-[--panel] p-8 text-center h-full flex flex-col justify-center items-center">
        <div className="absolute inset-0 bg-indigo-900/20 opacity-50" />
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-white">💎 Premium Only</h3>
            <p className="text-gray-400 my-4 text-sm">Mở khóa phân tích chuyên sâu từ Gemini AI Hub</p>
            <Link href="/pricing" className="bg-indigo-600 px-6 py-2 rounded-lg text-white font-bold text-sm hover:bg-indigo-500 transition-colors">
              Nâng cấp ngay
            </Link>
        </div>
    </div>
  )

  const result = stockHub?.geminiAnalysis

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] p-4 sm:p-5 shadow-2xl h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center mb-4 border-b border-indigo-500/20 pb-3 gap-2">
        <h3 className="text-lg sm:text-xl font-bold text-white flex gap-2 items-center">
            🤖 Deep Analysis
            {/* Visual Indicator if data comes from Hub Cache */}
            {hasAnalysis && localStatus === 'success' && (
               <span className="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded border border-indigo-500/30">
                 HUB CACHED
               </span>
            )}
        </h3>
        
        <div className="flex items-center gap-2">
            <StatusBadge status={localStatus} message={statusMsg} />
            {(result || localStatus === 'error') && localStatus !== 'ai_generating' && (
                <button 
                  onClick={handleAnalyze} 
                  className="p-1.5 hover:bg-white/10 rounded-full text-indigo-400 transition-colors"
                  title="Phân tích lại"
                >
                   🔄
                </button>
            )}
        </div>
      </div>

      {/* BODY */}
      <div className="flex-grow flex flex-col">
        {/* Error Message */}
        {localStatus === 'error' && (
          <div className="p-3 bg-rose-900/20 text-rose-300 rounded-lg text-center mb-4 border border-rose-500/20 text-sm">
              <p>⚠️ {errorMsg}</p>
              <button onClick={handleAnalyze} className="underline mt-1 font-semibold">Thử lại ngay</button>
          </div>
        )}

        {/* Initial Empty State */}
        {!result && localStatus === 'idle' && (
            <div className="flex-grow flex flex-col items-center justify-center py-8 text-center">
                <div className="text-5xl mb-4 animate-bounce">💎</div>
                <p className="text-gray-400 mb-6 text-sm max-w-xs">
                  Kết hợp dữ liệu Real-time & Trí tuệ nhân tạo để đưa ra nhận định.
                </p>
                <button 
                  onClick={handleAnalyze} 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                    <span>✨</span> Phân tích {symbol}
                </button>
            </div>
        )}

        {/* Result Content */}
        {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 1. Main Columns */}
                <div className="grid md:grid-cols-2 gap-4">
                    <AnalysisCard title="⚡ Kỹ thuật (Ngắn hạn)" data={result.shortTerm} colorClass="bg-slate-800/50 border-slate-700" />
                    <AnalysisCard title="📊 Cơ bản (Dài hạn)" data={result.longTerm} colorClass="bg-slate-800/50 border-slate-700" />
                </div>

                {/* 2. Recommendation Hub */}
                <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl">
                    <div className="flex justify-between items-end mb-3">
                        <h4 className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                            🎯 KHUYẾN NGHỊ TỪ HUB
                        </h4>
                        <span className="text-[10px] text-gray-500">
                          Cập nhật: {new Date(result.timestamp || Date.now()).toLocaleTimeString()}
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                        <ActionBox label="Vùng Mua" value={result.buyPrice} color="text-emerald-400" />
                        <ActionBox label="Mục Tiêu" value={result.targetPrice} color="text-blue-400" />
                        <ActionBox label="Cắt Lỗ" value={result.stopLoss} color="text-rose-400" />
                    </div>
                </div>

                {/* 3. Footer Stats (Risk/Opp) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-300">
                    {result.risks?.length > 0 && (
                        <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-900/30">
                            <b className="text-rose-400 block mb-1">⚠️ Rủi ro cần lưu ý</b>
                            <ul className="list-disc list-inside space-y-0.5 text-rose-200/80">
                                {result.risks.slice(0,2).map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                        </div>
                    )}
                    {result.opportunities?.length > 0 && (
                        <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-900/30">
                            <b className="text-emerald-400 block mb-1">🚀 Cơ hội tiềm năng</b>
                            <ul className="list-disc list-inside space-y-0.5 text-emerald-200/80">
                                {result.opportunities.slice(0,2).map((o, i) => <li key={i}>{o}</li>)}
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
