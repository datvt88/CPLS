'use client'

import { useState } from 'react'
import { fetchStockPrices, fetchFinancialRatios, fetchStockRecommendations, calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import type { FinancialRatio } from '@/types/vndirect'

interface GeminiDeepAnalysisWidgetProps {
    symbol: string
}

interface GeminiAnalysis {
    shortTerm?: {
        signal: string
        confidence: number
        summary: string
    }
    longTerm?: {
        signal: string
        confidence: number
        summary: string
    }
    targetPrice?: string
    stopLoss?: string
    risks?: string[]
    opportunities?: string[]
    rawText?: string
}

// Helper function to get current date in Vietnam timezone (GMT+7)
function getVietnamDate(): Date {
    const now = new Date()
    const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
    vietnamTime.setHours(0, 0, 0, 0)
    return vietnamTime
}

// Helper function to validate trading date
function isValidTradingDate(dateStr: string): boolean {
    const dataDate = new Date(dateStr)
    dataDate.setHours(0, 0, 0, 0)
    const today = getVietnamDate()
    return dataDate <= today
}

export default function GeminiDeepAnalysisWidget({ symbol }: GeminiDeepAnalysisWidgetProps) {
    const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasAnalyzed, setHasAnalyzed] = useState(false)

    const handleAnalyze = async () => {
        if (!symbol) return

        setLoading(true)
        setError(null)
        setGeminiAnalysis(null)

        try {
            console.log('🤖 Starting Gemini Deep Analysis for:', symbol)

            // Fetch all required data
            const [pricesResponse, ratiosResponse, recommendationsResponse, profitabilityResponse] = await Promise.all([
                fetchStockPrices(symbol, 270),
                fetchFinancialRatios(symbol),
                fetchStockRecommendations(symbol).catch(err => {
                    console.warn('⚠️ Failed to fetch recommendations, continuing without:', err)
                    return { data: [] }
                }),
                fetch(`/api/dnse/profitability?symbol=${symbol}&code=PROFITABLE_EFFICIENCY&cycleType=quy&cycleNumber=5`)
                    .then(res => res.json())
                    .catch(err => {
                        console.warn('⚠️ Failed to fetch profitability data, continuing without:', err)
                        return null
                    })
            ])

            if (!pricesResponse.data || pricesResponse.data.length === 0) {
                throw new Error('Không có dữ liệu giá')
            }

            // Process technical data
            const validData = pricesResponse.data.filter(item => isValidTradingDate(item.date))
            const sortedData = [...validData].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            )

            // Process fundamental data
            const ratiosMap: Record<string, FinancialRatio> = {}
            ratiosResponse.data.forEach(ratio => {
                ratiosMap[ratio.ratioCode] = ratio
            })

            // Call Gemini API
            const result = await fetchGeminiAnalysis(
                symbol,
                sortedData,
                ratiosMap,
                recommendationsResponse.data || [],
                profitabilityResponse
            )

            if (result) {
                console.log('✅ Gemini analysis completed for:', symbol)
                setGeminiAnalysis(result)
                setHasAnalyzed(true)
            } else {
                throw new Error('Không nhận được kết quả phân tích từ Gemini')
            }
        } catch (err: any) {
            console.error('❌ Error performing Gemini analysis:', err)
            setError(err.message || 'Không thể thực hiện phân tích Gemini')
        } finally {
            setLoading(false)
        }
    }

    const fetchGeminiAnalysis = async (
        symbol: string,
        priceData: any[],
        ratios: Record<string, FinancialRatio>,
        recommendations: any[],
        profitabilityData: any
    ): Promise<GeminiAnalysis | null> => {
        // Validate input data
        if (!priceData || priceData.length < 30) {
            throw new Error('Không đủ dữ liệu giá để phân tích (cần ít nhất 30 ngày)')
        }

        const closePrices = priceData.map(d => d.adClose)
        const currentPrice = closePrices[closePrices.length - 1]

        if (!currentPrice || isNaN(currentPrice)) {
            throw new Error('Giá hiện tại không hợp lệ')
        }

        const volumes = priceData.map(d => d.nmVolume)

        // Prepare technical data
        const ma10 = calculateSMA(closePrices, 10)
        const ma30 = calculateSMA(closePrices, 30)
        const bb = calculateBollingerBands(closePrices, 20, 2)

        const latestIdx = closePrices.length - 1
        const avgVolume10 = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10
        const currentVolume = volumes[volumes.length - 1]

        const priceChange5D = ((currentPrice - closePrices[closePrices.length - 6]) / closePrices[closePrices.length - 6]) * 100
        const priceChange10D = ((currentPrice - closePrices[closePrices.length - 11]) / closePrices[closePrices.length - 11]) * 100

        const high52W = Math.max(...closePrices)
        const low52W = Math.min(...closePrices)

        // Calculate buy price using pivot points
        let buyPrice: number | undefined
        if (priceData.length >= 2) {
            const latestDay = priceData[priceData.length - 1]
            const pivots = calculateWoodiePivotPoints(latestDay.adHigh, latestDay.adLow, latestDay.adClose)
            if (pivots) {
                buyPrice = pivots.S2
            }
        }

        const technicalData = {
            currentPrice,
            ma10: ma10[latestIdx],
            ma30: ma30[latestIdx],
            bollinger: {
                upper: bb.upper[latestIdx],
                middle: bb.middle[latestIdx],
                lower: bb.lower[latestIdx]
            },
            momentum: {
                day5: priceChange5D,
                day10: priceChange10D
            },
            volume: {
                current: currentVolume,
                avg10: avgVolume10,
                ratio: (currentVolume / avgVolume10) * 100
            },
            week52: {
                high: high52W,
                low: low52W
            },
            buyPrice
        }

        // Prepare fundamental data with detailed ROE/ROA quarterly data
        const fundamentalData = {
            pe: ratios['PRICE_TO_EARNINGS']?.value,
            pb: ratios['PRICE_TO_BOOK']?.value,
            roe: ratios['ROAE_TR_AVG5Q']?.value,
            roa: ratios['ROAA_TR_AVG5Q']?.value,
            dividendYield: ratios['DIVIDEND_YIELD']?.value,
            marketCap: ratios['MARKETCAP']?.value,
            freeFloat: ratios['FREEFLOAT']?.value,
            eps: ratios['EPS_TR']?.value,
            bvps: ratios['BVPS_CR']?.value,
            profitability: profitabilityData ? {
                quarters: profitabilityData.x || [],
                metrics: profitabilityData.data || []
            } : null
        }

        // Prepare analyst recommendations data (limit to top 10 most recent)
        const recentRecommendations = recommendations
            .slice(0, 10)
            .map(rec => ({
                firm: rec.firm,
                type: rec.type,
                reportDate: rec.reportDate,
                targetPrice: rec.targetPrice,
                reportPrice: rec.reportPrice
            }))

        // Call Gemini API with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        try {
            const response = await fetch('/api/gemini/stock-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symbol,
                    technicalData,
                    fundamentalData,
                    recommendations: recentRecommendations
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Lỗi API Gemini: ${response.status}`)
            }

            const data = await response.json()

            // Validate response structure
            if (!data || (!data.shortTerm && !data.longTerm)) {
                throw new Error('Định dạng phản hồi từ Gemini không hợp lệ')
            }

            return data as GeminiAnalysis
        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            if (fetchError.name === 'AbortError') {
                throw new Error('Yêu cầu đã hết thời gian chờ (30 giây). Vui lòng thử lại.')
            }
            throw fetchError
        }
    }

    return (
        <div className="bg-gradient-to-br from-indigo-900/20 to-violet-900/20 rounded-xl p-4 sm:p-6 border border-indigo-700/30">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2 flex-wrap">
                🤖 Gemini AI - Phân tích chuyên sâu - {symbol}
            </h3>

            {!hasAnalyzed && !loading && (
                <div className="text-center py-8">
                    <div className="mb-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-600/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <p className="text-gray-400 mb-4">
                            Click nút bên dưới để Gemini AI phân tích chuyên sâu cổ phiếu {symbol}
                        </p>
                        <p className="text-xs text-gray-500 mb-6">
                            Phân tích bao gồm: Đánh giá kỹ thuật, cơ bản, rủi ro, cơ hội và khuyến nghị giá
                        </p>
                    </div>
                    <button
                        onClick={handleAnalyze}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center gap-2 mx-auto"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Bắt đầu phân tích với Gemini AI
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center h-40">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-gray-400 text-sm">AI đang phân tích dữ liệu kỹ thuật và cơ bản...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                    <p className="text-red-400 mb-3">{error}</p>
                    <button
                        onClick={handleAnalyze}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors"
                    >
                        Thử lại
                    </button>
                </div>
            )}

            {geminiAnalysis && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4">
                        {/* Gemini Short-term */}
                        {geminiAnalysis.shortTerm && (
                            <div className="bg-cyan-900/20 rounded-lg p-3 sm:p-4 border border-cyan-700/30">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-semibold text-cyan-300">⚡ Ngắn hạn</h5>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded text-sm font-bold ${geminiAnalysis.shortTerm.signal.includes('MUA') ? 'bg-green-600' :
                                            geminiAnalysis.shortTerm.signal.includes('BÁN') ? 'bg-red-600' : 'bg-yellow-600'
                                            }`}>
                                            {geminiAnalysis.shortTerm.signal}
                                        </span>
                                        <span className="text-sm text-gray-400">{geminiAnalysis.shortTerm.confidence}%</span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{geminiAnalysis.shortTerm.summary}</p>
                            </div>
                        )}

                        {/* Gemini Long-term */}
                        {geminiAnalysis.longTerm && (
                            <div className="bg-purple-900/20 rounded-lg p-3 sm:p-4 border border-purple-700/30">
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-semibold text-purple-300">🎯 Dài hạn</h5>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded text-sm font-bold ${geminiAnalysis.longTerm.signal.includes('MUA') ? 'bg-green-600' :
                                            geminiAnalysis.longTerm.signal.includes('BÁN') ? 'bg-red-600' : 'bg-yellow-600'
                                            }`}>
                                            {geminiAnalysis.longTerm.signal}
                                        </span>
                                        <span className="text-sm text-gray-400">{geminiAnalysis.longTerm.confidence}%</span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{geminiAnalysis.longTerm.summary}</p>
                            </div>
                        )}
                    </div>

                    {/* Price Targets and Stop Loss */}
                    {(geminiAnalysis.targetPrice || geminiAnalysis.stopLoss) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4">
                            {geminiAnalysis.targetPrice && (
                                <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                                    <div className="text-xs text-gray-400 mb-1">🎯 Giá mục tiêu</div>
                                    <div className="text-base sm:text-lg font-bold text-green-400">{geminiAnalysis.targetPrice}</div>
                                </div>
                            )}
                            {geminiAnalysis.stopLoss && (
                                <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
                                    <div className="text-xs text-gray-400 mb-1">🛑 Mức cắt lỗ</div>
                                    <div className="text-base sm:text-lg font-bold text-red-400">{geminiAnalysis.stopLoss}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Risks and Opportunities */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Risks */}
                        {geminiAnalysis.risks && geminiAnalysis.risks.length > 0 && (
                            <div className="bg-red-900/10 rounded-lg p-3 sm:p-4 border border-red-700/20">
                                <h5 className="text-xs sm:text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                                    ⚠️ Rủi ro
                                </h5>
                                <ul className="space-y-1">
                                    {geminiAnalysis.risks.map((risk, idx) => (
                                        <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                            <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                                            <span className="break-words">{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Opportunities */}
                        {geminiAnalysis.opportunities && geminiAnalysis.opportunities.length > 0 && (
                            <div className="bg-green-900/10 rounded-lg p-3 sm:p-4 border border-green-700/20">
                                <h5 className="text-xs sm:text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                                    💡 Cơ hội
                                </h5>
                                <ul className="space-y-1">
                                    {geminiAnalysis.opportunities.map((opp, idx) => (
                                        <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                                            <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                                            <span className="break-words">{opp}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Re-analyze button */}
                    <div className="mt-4 pt-4 border-t border-indigo-700/30 text-center">
                        <button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm transition-colors disabled:opacity-50"
                        >
                            🔄 Phân tích lại
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
