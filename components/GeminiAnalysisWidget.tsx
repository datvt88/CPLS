'use client'

import { useState, useCallback } from 'react'
import { 
    fetchStockPrices, 
    fetchFinancialRatios, 
    fetchStockRecommendations, 
    calculateSMA, 
    calculateBollingerBands, 
    calculateWoodiePivotPoints 
} from '@/services/vndirect'
import type { FinancialRatio } from '@/types/vndirect'
import { formatPrice } from '@/utils/formatters' // Import hàm format giá
import { usePermissions } from '@/contexts/PermissionsContext'
import Link from 'next/link'

// --- 1. TYPES ---
type Signal = 'MUA' | 'BÁN' | 'NẮM GIỮ'
type ConnectionStatus = 'idle' | 'fetching' | 'processing' | 'ai_generating' | 'success' | 'error'

interface Evaluation { 
    signal: Signal; 
    confidence: number; 
    reasons: string[]; 
    currentPrice?: number; 
    buyPrice?: number; 
    cutLossPrice?: number 
}

export interface RuleBasedAnalysis { 
    shortTerm: Evaluation; 
    longTerm: Evaluation 
}

// --- 2. PURE LOGIC HELPER FUNCTIONS ---
const analyzeTechnical = (priceData: any[]): Evaluation => {
    const reasons: string[] = []
    let score = 0
    const close = priceData.map(d => d.adClose)
    const last = priceData.length - 1
    const currentPrice = close[last]

    // MA Analysis
    const ma10 = calculateSMA(close, 10)[last], ma30 = calculateSMA(close, 30)[last]
    if (ma10 && ma30) {
        const diff = ((ma10 - ma30) / ma30) * 100
        score += diff > 0 ? (diff > 2 ? 30 : 20) : (diff < -2 ? -30 : -20)
        reasons.push(`MA10 ${diff > 0 ? 'cắt lên' : 'cắt xuống'} MA30 (${Math.abs(diff).toFixed(2)}%)`)
    }

    // Bollinger Bands
    const { upper, lower } = calculateBollingerBands(close, 20, 2)
    const pos = (currentPrice - lower[last]) / (upper[last] - lower[last])
    if (pos <= 0.2) { score += 25; reasons.push('Giá chạm vùng hỗ trợ (Lower Band)') }
    else if (pos >= 0.8) { score -= 25; reasons.push('Giá chạm vùng kháng cự (Upper Band)') }

    // Momentum
    const chg5d = ((currentPrice - close[Math.max(0, last - 5)]) / close[Math.max(0, last - 5)]) * 100
    if (Math.abs(chg5d) > 3) {
        score += chg5d > 0 ? 20 : -20
        reasons.push(`Biến động 5 phiên: ${chg5d > 0 ? '+' : ''}${chg5d.toFixed(1)}%`)
    }

    // Pivot Points
    let buyPrice, cutLossPrice
    if (priceData.length > 1) {
        const d = priceData[last]
        const p = calculateWoodiePivotPoints(d.adHigh, d.adLow, d.adClose)
        if (p) { buyPrice = p.S2; cutLossPrice = p.S2 * 0.93 }
    }

    return { 
        signal: score > 15 ? 'MUA' : score < -15 ? 'BÁN' : 'NẮM GIỮ', 
        confidence: Math.min(Math.abs(score), 100), 
        reasons, currentPrice, buyPrice, cutLossPrice 
    }
}

const analyzeFundamental = (ratios: Record<string, FinancialRatio>, profit: any): Evaluation => {
    const reasons: string[] = []
    let score = 0
    
    const pe = ratios['PRICE_TO_EARNINGS']?.value
    if (pe) {
        if (pe > 0 && pe < 12) { score += 25; reasons.push(`P/E thấp (${pe.toFixed(1)}x)`) }
        else if (pe > 25) { score -= 25; reasons.push(`P/E cao (${pe.toFixed(1)}x)`) }
    }

    let roe = ratios['ROAE_TR_AVG5Q']?.value * 100 || 0
    // Lấy dữ liệu ROE mới nhất từ API profitability nếu có
    if (profit?.data) {
         const roeItem = profit.data.find((x: any) => x.label === 'ROE')
         if (roeItem?.y?.length) roeVal = roeItem.y[roeItem.y.length - 1]
    }
    
    if (roe > 15) { score += 30; reasons.push(`ROE ấn tượng (${roe.toFixed(1)}%)`) }
    else if (roe < 8) { score -= 20; reasons.push(`ROE thấp (${roe.toFixed(1)}%)`) }

    return { 
        signal: score > 10 ? 'MUA' : score < -10 ? 'BÁN' : 'NẮM GIỮ', 
        confidence: Math.min(Math.abs(score) + 20, 100), 
        reasons 
    }
}

// --- 3. UI COMPONENTS ---
const StatusBadge = ({ status, message }: { status: ConnectionStatus, message: string }) => {
    const getColor = () => {
        switch(status) {
            case 'fetching': return 'bg-yellow-500 animate-pulse'
            case 'processing': return 'bg-blue-500 animate-pulse'
            case 'ai_generating': return 'bg-purple-500 animate-pulse'
            case 'success': return 'bg-emerald-500'
            case 'error': return 'bg-rose-500'
            default: return 'bg-slate-500'
        }
    }
    
    return (
        <div className="flex items-center gap-2 text-xs font-medium bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
            <span className={`h-2 w-2 rounded-full ${getColor()}`}></span>
            <span className="text-slate-300">{message}</span>
        </div>
    )
}

const AnalysisCard = ({ title, data, colorClass }: { title: string, data: any, colorClass: string }) => {
    if (!data) return null
    return (
        <div className={`rounded-xl p-4 border bg-opacity-20 ${colorClass}`}>
            <div className="flex justify-between mb-3 items-center">
                <h4 className="font-semibold text-white">{title}</h4>
                <span className={`px-2 py-1 rounded text-xs font-bold ${data.signal === 'MUA' ? 'bg-emerald-600' : data.signal === 'BÁN' ? 'bg-rose-600' : 'bg-amber-600'}`}>{data.signal}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mb-3 overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${data.signal === 'MUA' ? 'bg-emerald-500' : data.signal === 'BÁN' ? 'bg-rose-500' : 'bg-amber-500'}`} style={{width: `${data.confidence}%`}}/>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{data.summary}</p>
        </div>
    )
}

const ActionBox = ({ label, value, color }: { label: string, value: number | null | undefined, color: string }) => {
    if (!value) return null
    return (
        <div className="rounded-lg bg-slate-900/50 p-3 text-center border border-slate-700">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{formatPrice(value)}</div>
        </div>
    )
}

// --- 4. MAIN WIDGET ---
export default function GeminiAnalysisWidget({ symbol }: { symbol: string }) {
    const { isPremium, isAuthenticated, isLoading: authLoading } = usePermissions()
    const [result, setResult] = useState<any>(null)
    const [status, setStatus] = useState<ConnectionStatus>('idle')
    const [statusMsg, setStatusMsg] = useState('Sẵn sàng')
    const [error, setError] = useState<string | null>(null)

    const handleAnalyze = async () => {
        if (!symbol || (!isPremium && !isAuthenticated)) return
        
        setError(null)
        setResult(null)
        
        try {
            // STEP 1: Fetching
            setStatus('fetching')
            setStatusMsg('Đang tải dữ liệu thị trường...')
            
            const [prices, ratios, recs, profits] = await Promise.all([
                fetchStockPrices(symbol, 270),
                fetchFinancialRatios(symbol),
                fetchStockRecommendations(symbol).catch(() => ({ data: [] })),
                fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`).then(r => r.json()).catch(() => null)
            ])

            // Validation: Đảm bảo có dữ liệu giá
            if (!prices.data || prices.data.length < 30) {
                throw new Error('Không đủ dữ liệu giá (cần >30 phiên)')
            }

            // STEP 2: Local Processing
            setStatus('processing')
            setStatusMsg('Tính toán chỉ báo kỹ thuật...')

            const validData = prices.data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
            const ratiosMap: Record<string, FinancialRatio> = {}
            ratios.data.forEach((r: any) => ratiosMap[r.ratioCode] = r)

            const ruleAnalysis: RuleBasedAnalysis = {
                shortTerm: analyzeTechnical(validData),
                longTerm: analyzeFundamental(ratiosMap, profits)
            }

            // STEP 3: AI Generation
            setStatus('ai_generating')
            setStatusMsg('Gemini AI đang phân tích...')

            const res = await fetch('/api/gemini/stock-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    technicalData: {
                        currentPrice: ruleAnalysis.shortTerm.currentPrice,
                        buyPrice: ruleAnalysis.shortTerm.buyPrice,
                        // Thêm context cho AI
                        maSignal: ruleAnalysis.shortTerm.reasons[0]
                    },
                    fundamentalData: {
                        pe: ratiosMap['PRICE_TO_EARNINGS']?.value,
                        roe: ratiosMap['ROAE_TR_AVG5Q']?.value,
                        pb: ratiosMap['PRICE_TO_BOOK']?.value,
                        marketCap: ratiosMap['MARKETCAP']?.value
                    },
                    recommendations: recs.data.slice(0, 5),
                    ruleBasedAnalysis: ruleAnalysis,
                    model: 'gemini-1.5-flash'
                })
            })

            if (!res.ok) throw new Error('Kết nối AI thất bại')
            const data = await res.json()

            // STEP 4: Success
            setResult(data)
            setStatus('success')
            setStatusMsg('Phân tích hoàn tất')

        } catch (err: any) {
            console.error(err)
            setStatus('error')
            setStatusMsg('Lỗi phân tích')
            setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại')
        }
    }

    // --- RENDER ---
    if (authLoading) return <div className="h-40 bg-[--panel] animate-pulse rounded-xl border border-gray-800" />
    
    if (!isPremium) return (
        <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-[--panel] p-8 text-center">
            <div className="absolute inset-0 bg-indigo-900/20 opacity-50"/>
            <div className="relative z-10">
                <span className="text-4xl">🔒</span>
                <h3 className="text-xl font-bold text-white mt-2">Tính năng Premium</h3>
                <div className="mt-4">
                    {!isAuthenticated ? <Link href="/login" className="btn-primary">Đăng nhập</Link> : <Link href="/pricing" className="btn-premium">Nâng cấp</Link>}
                </div>
            </div>
        </div>
    )

    return (
        <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] p-4 sm:p-6 shadow-2xl">
            {/* HEADER & STATUS */}
            <div className="flex flex-wrap justify-between items-center mb-6 border-b border-indigo-500/20 pb-4 gap-3">
                <h3 className="text-xl font-bold text-white flex gap-2 items-center">
                    🤖 Gemini AI <span className="bg-amber-500 text-xs px-2 rounded">PRO</span>
                </h3>
                
                {/* Status Indicator */}
                <div className="flex items-center gap-3">
                    <StatusBadge status={status} message={statusMsg} />
                    {result && status !== 'fetching' && status !== 'ai_generating' && (
                        <button onClick={handleAnalyze} className="text-indigo-400 text-sm hover:underline">🔄</button>
                    )}
                </div>
            </div>

            {/* INITIAL STATE */}
            {!result && status === 'idle' && (
                <div className="text-center py-8">
                    <p className="text-gray-400 mb-6 text-sm">Kết hợp dữ liệu Real-time VNDirect & Trí tuệ nhân tạo</p>
                    <button onClick={handleAnalyze} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105">
                        ✨ Phân tích {symbol} ngay
                    </button>
                </div>
            )}

            {/* ERROR STATE */}
            {status === 'error' && (
                <div className="p-4 bg-rose-900/20 text-rose-300 rounded-lg text-center mb-4 border border-rose-500/20">
                    <p>{error}</p>
                    <button onClick={handleAnalyze} className="underline mt-2 text-sm">Thử lại</button>
                </div>
            )}

            {/* RESULTS */}
            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    {/* 1. Main Analysis Cards */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <AnalysisCard title="⚡ Kỹ thuật (Ngắn hạn)" data={result.shortTerm} colorClass="bg-slate-800/50 border-slate-700" />
                        <AnalysisCard title="💎 Cơ bản (Dài hạn)" data={result.longTerm} colorClass="bg-slate-800/50 border-slate-700" />
                    </div>

                    {/* 2. Action Zone */}
                    {(result.buyPrice || result.targetPrice) && (
                        <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl">
                            <h4 className="text-emerald-400 font-bold mb-3 text-sm flex items-center gap-2">
                                🎯 KHUYẾN NGHỊ HÀNH ĐỘNG 
                                <span className="text-xs font-normal text-emerald-600">(Dựa trên Pivot Points & AI)</span>
                            </h4>
                            <div className="grid grid-cols-3 gap-3">
                                <ActionBox label="Vùng Mua" value={result.buyPrice ? Number(result.buyPrice) : null} color="text-emerald-400" />
                                <ActionBox label="Mục Tiêu" value={result.targetPrice ? Number(result.targetPrice) : null} color="text-blue-400" />
                                <ActionBox label="Cắt Lỗ" value={result.stopLoss ? Number(result.stopLoss) : null} color="text-rose-400" />
                            </div>
                        </div>
                    )}

                    {/* 3. Risks & Opportunities */}
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
                        {result.risks?.length > 0 && (
                            <div className="bg-rose-900/10 p-4 rounded-xl border border-rose-900/30">
                                <b className="text-rose-400 block mb-2 flex items-center gap-2">⚠️ Rủi ro cần chú ý</b>
                                <ul className="space-y-1">
                                    {result.risks.slice(0, 3).map((r: string, i: number) => (
                                        <li key={i} className="flex gap-2"><span className="text-rose-500">•</span> {r}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {result.opportunities?.length > 0 && (
                            <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30">
                                <b className="text-emerald-400 block mb-2 flex items-center gap-2">🚀 Cơ hội tiềm năng</b>
                                <ul className="space-y-1">
                                    {result.opportunities.slice(0, 3).map((o: string, i: number) => (
                                        <li key={i} className="flex gap-2"><span className="text-emerald-500">•</span> {o}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
