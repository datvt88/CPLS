'use client'

import { useState } from 'react'
import { fetchStockPrices, fetchFinancialRatios, fetchStockRecommendations, calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import type { FinancialRatio } from '@/types/vndirect'
import { usePermissions } from '@/components/providers/PermissionsContext'
import Link from 'next/link'

// --- 1. TYPES ---
type Signal = 'MUA' | 'BÁN' | 'NẮM GIỮ'
interface Evaluation { signal: Signal; confidence: number; reasons: string[]; currentPrice?: number; buyPrice?: number; cutLossPrice?: number }
export interface RuleBasedAnalysis { shortTerm: Evaluation; longTerm: Evaluation }

// --- 2. PURE LOGIC HELPER FUNCTIONS (Tách khỏi Component để tối ưu tốc độ) ---
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
        reasons.push(`MA10 ${diff > 0 ? 'cắt lên' : 'cắt xuống'} MA30 (${diff.toFixed(2)}%)`)
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
    if (roe > 15) { score += 30; reasons.push(`ROE tốt (${roe.toFixed(1)}%)`) }
    else if (roe < 8) { score -= 20; reasons.push(`ROE thấp (${roe.toFixed(1)}%)`) }

    return { 
        signal: score > 10 ? 'MUA' : score < -10 ? 'BÁN' : 'NẮM GIỮ', 
        confidence: Math.min(Math.abs(score) + 20, 100), 
        reasons 
    }
}

// --- 3. SUB-COMPONENTS (Giảm JSX cho component chính) ---
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
            <p className="text-sm text-gray-300">{data.summary}</p>
        </div>
    )
}

const ActionBox = ({ label, value, color }: { label: string, value: string | null | undefined, color: string }) => {
    if (!value) return null
    return (
        <div className="rounded-lg bg-slate-900/50 p-3 text-center border border-slate-700">
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
        </div>
    )
}

// --- 4. MAIN COMPONENT ---
export default function GeminiAnalysisWidget({ symbol }: { symbol: string }) {
    const { isPremium, isAuthenticated, isLoading: authLoading } = usePermissions()
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleAnalyze = async () => {
        if (!symbol || (!isPremium && !isAuthenticated)) return
        setLoading(true); setError(null); setResult(null)

        try {
            const [prices, ratios, recs, profits] = await Promise.all([
                fetchStockPrices(symbol, 270),
                fetchFinancialRatios(symbol),
                fetchStockRecommendations(symbol).catch(() => ({ data: [] })),
                fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`).then(r => r.json()).catch(() => null)
            ])

            if (!prices.data?.length) throw new Error('Không có dữ liệu')

            // Xử lý dữ liệu
            const validData = prices.data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
            const ratiosMap: Record<string, FinancialRatio> = {}
            ratios.data.forEach((r: any) => ratiosMap[r.ratioCode] = r)

            // Chạy Logic Rule-Based
            const ruleAnalysis: RuleBasedAnalysis = {
                shortTerm: analyzeTechnical(validData),
                longTerm: analyzeFundamental(ratiosMap, profits)
            }

            // Gọi AI
            const res = await fetch('/api/gemini/stock-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    technicalData: {
                        currentPrice: ruleAnalysis.shortTerm.currentPrice,
                        buyPrice: ruleAnalysis.shortTerm.buyPrice,
                    },
                    fundamentalData: {
                        pe: ratiosMap['PRICE_TO_EARNINGS']?.value,
                        roe: ratiosMap['ROAE_TR_AVG5Q']?.value,
                    },
                    recommendations: recs.data.slice(0, 5),
                    ruleBasedAnalysis: ruleAnalysis, // Gửi kết quả tính toán lên cho AI
                    model: 'gemini-1.5-flash'
                })
            })

            if (!res.ok) throw new Error('Lỗi kết nối AI server')
            const data = await res.json()
            setResult(data)

        } catch (err: any) {
            setError(err.message || 'Lỗi phân tích')
        } finally {
            setLoading(false)
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
            <div className="flex justify-between items-center mb-6 border-b border-indigo-500/20 pb-4">
                <h3 className="text-xl font-bold text-white flex gap-2 items-center">
                    🤖 Gemini AI <span className="bg-amber-500 text-xs px-2 rounded">PRO</span>
                </h3>
                {result && <button onClick={handleAnalyze} disabled={loading} className="text-indigo-400 text-sm hover:underline">🔄 Làm mới</button>}
            </div>

            {!result && !loading && (
                <div className="text-center py-8">
                    <button onClick={handleAnalyze} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105">
                        ✨ Phân tích {symbol} ngay
                    </button>
                </div>
            )}

            {loading && <div className="py-12 text-center text-indigo-300 animate-pulse">🤖 Đang phân tích dữ liệu...</div>}
            {error && <div className="p-4 bg-rose-900/20 text-rose-300 rounded-lg text-center">{error} <button onClick={handleAnalyze} className="underline ml-2">Thử lại</button></div>}

            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <AnalysisCard title="⚡ Kỹ thuật (Ngắn hạn)" data={result.shortTerm} colorClass="bg-slate-800/50 border-slate-700" />
                        <AnalysisCard title="💎 Cơ bản (Dài hạn)" data={result.longTerm} colorClass="bg-slate-800/50 border-slate-700" />
                    </div>

                    {(result.buyPrice || result.targetPrice) && (
                        <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl">
                            <h4 className="text-emerald-400 font-bold mb-3 text-sm">🎯 KHUYẾN NGHỊ HÀNH ĐỘNG</h4>
                            <div className="grid grid-cols-3 gap-3">
                                <ActionBox label="Vùng Mua" value={result.buyPrice} color="text-emerald-400" />
                                <ActionBox label="Mục Tiêu" value={result.targetPrice} color="text-blue-400" />
                                <ActionBox label="Cắt Lỗ" value={result.stopLoss} color="text-rose-400" />
                            </div>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
                        {result.risks?.length > 0 && (
                            <div className="bg-rose-900/10 p-4 rounded-xl border border-rose-900/30">
                                <b className="text-rose-400 block mb-2">⚠️ Rủi ro</b>
                                <ul className="list-disc pl-4 space-y-1">{result.risks.slice(0, 3).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                            </div>
                        )}
                        {result.opportunities?.length > 0 && (
                            <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30">
                                <b className="text-emerald-400 block mb-2">🚀 Cơ hội</b>
                                <ul className="list-disc pl-4 space-y-1">{result.opportunities.slice(0, 3).map((o: string, i: number) => <li key={i}>{o}</li>)}</ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
