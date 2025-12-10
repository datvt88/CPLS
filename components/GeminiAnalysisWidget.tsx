'use client'

import { useState } from 'react'
import { fetchStockPrices, fetchFinancialRatios, fetchStockRecommendations, calculateSMA, calculateBollingerBands, calculateWoodiePivotPoints } from '@/services/vndirect'
import type { FinancialRatio } from '@/types/vndirect'

interface GeminiDeepAnalysisWidgetProps {
    symbol: string
}

interface GeminiAnalysis {
    shortTerm?: {
        signal: string  // 'MUA', 'BÁN', 'THEO DÕI'
        confidence: number
        summary: string
    }
    longTerm?: {
        signal: string  // 'MUA', 'BÁN', 'THEO DÕI'
        confidence: number
        summary: string
    }
    buyPrice?: string | null  // Giá khuyến nghị mua
    targetPrice?: string | null  // Giá mục tiêu
    stopLoss?: string | null  // Mức cắt lỗ
    risks?: string[]  // Đúng 3 rủi ro
    opportunities?: string[]  // Đúng 3 cơ hội
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
                console.log('✅ Gemini analysis completed for:', symbol, result)
                setGeminiAnalysis(result)
                setHasAnalyzed(true)
            } else {
                console.error('❌ fetchGeminiAnalysis returned null for:', symbol)
                throw new Error('Không nhận được kết quả phân tích từ Gemini. Vui lòng thử lại.')
            }
        } catch (err: any) {
            console.error('❌ Error performing Gemini analysis:', err)
            // Show more detailed error message
            const errorMessage = err.message || 'Không thể thực hiện phân tích Gemini'
            setError(errorMessage)
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

        // Calculate technical signals
        const ma10Value = ma10[latestIdx]
        const ma30Value = ma30[latestIdx]
        const maTrend = ma10Value && ma30Value
            ? (ma10Value > ma30Value ? 'TĂNG' : ma10Value < ma30Value ? 'GIẢM' : 'TRUNG LẬP')
            : 'KHÔNG XÁC ĐỊNH'

        // Detect recent MA crossover (last 5 days)
        let lastCrossover: string | null = null
        for (let i = latestIdx; i >= Math.max(0, latestIdx - 5); i--) {
            if (ma10[i] && ma30[i] && ma10[i-1] && ma30[i-1]) {
                if (ma10[i-1] <= ma30[i-1] && ma10[i] > ma30[i]) {
                    lastCrossover = 'GOLDEN_CROSS'
                    break
                }
                if (ma10[i-1] >= ma30[i-1] && ma10[i] < ma30[i]) {
                    lastCrossover = 'DEATH_CROSS'
                    break
                }
            }
        }

        // Bollinger position analysis
        const bbUpper = bb.upper[latestIdx]
        const bbLower = bb.lower[latestIdx]
        const bollingerPosition = bbUpper && bbLower
            ? ((currentPrice - bbLower) / (bbUpper - bbLower) * 100)
            : 50
        const bollingerSignal = bollingerPosition >= 80 ? 'QUÁ MUA'
            : bollingerPosition <= 20 ? 'QUÁ BÁN'
            : 'TRUNG LẬP'

        // 52-week position
        const week52Position = ((currentPrice - low52W) / (high52W - low52W) * 100)
        const week52Signal = week52Position >= 80 ? 'GẦN ĐỈNH'
            : week52Position <= 20 ? 'GẦN ĐÁY'
            : 'GIỮA RANGE'

        // Volume signal
        const volumeRatio = (currentVolume / avgVolume10) * 100
        const volumeSignal = volumeRatio >= 150 ? 'TĂNG MẠNH'
            : volumeRatio <= 70 ? 'THẤP'
            : 'BÌNH THƯỜNG'

        const technicalData = {
            currentPrice,
            ma10: ma10Value,
            ma30: ma30Value,
            maTrend,
            lastCrossover,
            bollinger: {
                upper: bbUpper,
                middle: bb.middle[latestIdx],
                lower: bbLower
            },
            bollingerPosition: Math.round(bollingerPosition),
            bollingerSignal,
            momentum: {
                day5: priceChange5D,
                day10: priceChange10D
            },
            volume: {
                current: currentVolume,
                avg10: avgVolume10,
                ratio: volumeRatio
            },
            volumeSignal,
            week52: {
                high: high52W,
                low: low52W,
                position: Math.round(week52Position)
            },
            week52Signal,
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

        // Prepare analyst recommendations data with statistics
        const buyRecs = recommendations.filter(r => r.type === 'BUY')
        const holdRecs = recommendations.filter(r => r.type === 'HOLD')
        const sellRecs = recommendations.filter(r => r.type === 'SELL')
        const totalRecs = recommendations.length

        // Calculate consensus
        let consensus = 'KHÔNG CÓ'
        if (totalRecs > 0) {
            const buyPercent = (buyRecs.length / totalRecs) * 100
            const sellPercent = (sellRecs.length / totalRecs) * 100
            if (buyPercent >= 50) consensus = 'MUA'
            else if (sellPercent >= 50) consensus = 'BÁN'
            else consensus = 'GIỮ'
        }

        // Average target price
        const recsWithTarget = recommendations.filter(r => r.targetPrice && !isNaN(r.targetPrice))
        const avgTargetPrice = recsWithTarget.length > 0
            ? recsWithTarget.reduce((sum, r) => sum + r.targetPrice, 0) / recsWithTarget.length
            : null

        const recommendationsData = {
            statistics: {
                total: totalRecs,
                buy: buyRecs.length,
                hold: holdRecs.length,
                sell: sellRecs.length,
                buyPercent: totalRecs > 0 ? Math.round((buyRecs.length / totalRecs) * 100) : 0,
                holdPercent: totalRecs > 0 ? Math.round((holdRecs.length / totalRecs) * 100) : 0,
                sellPercent: totalRecs > 0 ? Math.round((sellRecs.length / totalRecs) * 100) : 0,
                consensus,
                avgTargetPrice
            },
            recent: recommendations.slice(0, 5).map(rec => ({
                firm: rec.firm,
                type: rec.type,
                targetPrice: rec.targetPrice
            }))
        }

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
                    recommendations: recommendationsData
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Lỗi API Gemini: ${response.status}`)
            }

            const data = await response.json()

            console.log('📥 Gemini API response:', data)

            // Validate response structure - accept partial results
            if (!data) {
                console.error('Empty response from Gemini API')
                throw new Error('Không nhận được dữ liệu từ Gemini')
            }

            // Check if we have at least some valid data
            if (!data.shortTerm && !data.longTerm && !data.risks && !data.opportunities) {
                console.error('Invalid Gemini response structure:', data)
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
                        {/* Gemini Short-term - 70% Technical */}
                        {geminiAnalysis.shortTerm && (
                            <div className="bg-cyan-900/20 rounded-lg p-3 sm:p-4 border border-cyan-700/30">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h5 className="font-semibold text-cyan-300">⚡ Ngắn hạn (1-4 tuần)</h5>
                                        <p className="text-xs text-gray-500">70% Kỹ thuật + 30% Cơ bản</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded text-sm font-bold ${
                                            geminiAnalysis.shortTerm.signal === 'MUA' ? 'bg-green-600' :
                                            geminiAnalysis.shortTerm.signal === 'BÁN' ? 'bg-red-600' : 'bg-amber-600'
                                        }`}>
                                            {geminiAnalysis.shortTerm.signal === 'MUA' ? '📈 MUA' :
                                             geminiAnalysis.shortTerm.signal === 'BÁN' ? '📉 BÁN' : '👀 THEO DÕI'}
                                        </span>
                                        <span className="text-sm text-gray-400">{geminiAnalysis.shortTerm.confidence}%</span>
                                    </div>
                                </div>
                                {/* Confidence Bar */}
                                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                                    <div
                                        className={`h-2 rounded-full transition-all ${
                                            geminiAnalysis.shortTerm.signal === 'MUA' ? 'bg-green-500' :
                                            geminiAnalysis.shortTerm.signal === 'BÁN' ? 'bg-red-500' : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${geminiAnalysis.shortTerm.confidence}%` }}
                                    ></div>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{geminiAnalysis.shortTerm.summary}</p>
                            </div>
                        )}

                        {/* Gemini Long-term - 70% Fundamental */}
                        {geminiAnalysis.longTerm && (
                            <div className="bg-purple-900/20 rounded-lg p-3 sm:p-4 border border-purple-700/30">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h5 className="font-semibold text-purple-300">🎯 Dài hạn (3-12 tháng)</h5>
                                        <p className="text-xs text-gray-500">70% Cơ bản + 30% Kỹ thuật</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded text-sm font-bold ${
                                            geminiAnalysis.longTerm.signal === 'MUA' ? 'bg-green-600' :
                                            geminiAnalysis.longTerm.signal === 'BÁN' ? 'bg-red-600' : 'bg-amber-600'
                                        }`}>
                                            {geminiAnalysis.longTerm.signal === 'MUA' ? '📈 MUA' :
                                             geminiAnalysis.longTerm.signal === 'BÁN' ? '📉 BÁN' : '👀 THEO DÕI'}
                                        </span>
                                        <span className="text-sm text-gray-400">{geminiAnalysis.longTerm.confidence}%</span>
                                    </div>
                                </div>
                                {/* Confidence Bar */}
                                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
                                    <div
                                        className={`h-2 rounded-full transition-all ${
                                            geminiAnalysis.longTerm.signal === 'MUA' ? 'bg-green-500' :
                                            geminiAnalysis.longTerm.signal === 'BÁN' ? 'bg-red-500' : 'bg-amber-500'
                                        }`}
                                        style={{ width: `${geminiAnalysis.longTerm.confidence}%` }}
                                    ></div>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{geminiAnalysis.longTerm.summary}</p>
                            </div>
                        )}
                    </div>

                    {/* Price Recommendations - Only show when signal is MUA */}
                    {(geminiAnalysis.shortTerm?.signal === 'MUA' || geminiAnalysis.longTerm?.signal === 'MUA') &&
                     (geminiAnalysis.buyPrice || geminiAnalysis.targetPrice || geminiAnalysis.stopLoss) && (
                        <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-lg p-4 border border-green-700/30 mb-4">
                            <h5 className="font-semibold text-green-300 mb-3 flex items-center gap-2">
                                💰 Khuyến nghị giá (Khi tín hiệu MUA)
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {geminiAnalysis.buyPrice && (
                                    <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/30">
                                        <div className="text-xs text-gray-400 mb-1">🛒 Giá khuyến nghị MUA</div>
                                        <div className="text-lg font-bold text-blue-400">{geminiAnalysis.buyPrice}</div>
                                        <div className="text-xs text-gray-500 mt-1">Vùng mua tốt</div>
                                    </div>
                                )}
                                {geminiAnalysis.targetPrice && (
                                    <div className="bg-green-900/30 rounded-lg p-3 border border-green-700/30">
                                        <div className="text-xs text-gray-400 mb-1">🎯 Giá mục tiêu</div>
                                        <div className="text-lg font-bold text-green-400">{geminiAnalysis.targetPrice}</div>
                                        <div className="text-xs text-gray-500 mt-1">Chốt lời</div>
                                    </div>
                                )}
                                {geminiAnalysis.stopLoss && (
                                    <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/30">
                                        <div className="text-xs text-gray-400 mb-1">🛑 Mức CẮT LỖ</div>
                                        <div className="text-lg font-bold text-red-400">{geminiAnalysis.stopLoss}</div>
                                        <div className="text-xs text-yellow-400 mt-1">⚠️ Thoát nếu phá vỡ</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Risks and Opportunities - Always show exactly 3 each */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* 3 Risks */}
                        {geminiAnalysis.risks && geminiAnalysis.risks.length > 0 && (
                            <div className="bg-red-900/10 rounded-lg p-3 sm:p-4 border border-red-700/20">
                                <h5 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                                    ⚠️ 3 Rủi ro chính
                                </h5>
                                <ul className="space-y-2">
                                    {geminiAnalysis.risks.slice(0, 3).map((risk, idx) => (
                                        <li key={idx} className="text-sm text-gray-300 flex items-start gap-2 bg-red-900/10 rounded p-2">
                                            <span className="text-red-400 font-bold flex-shrink-0">{idx + 1}.</span>
                                            <span className="break-words">{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 3 Opportunities */}
                        {geminiAnalysis.opportunities && geminiAnalysis.opportunities.length > 0 && (
                            <div className="bg-green-900/10 rounded-lg p-3 sm:p-4 border border-green-700/20">
                                <h5 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                                    💡 3 Cơ hội chính
                                </h5>
                                <ul className="space-y-2">
                                    {geminiAnalysis.opportunities.slice(0, 3).map((opp, idx) => (
                                        <li key={idx} className="text-sm text-gray-300 flex items-start gap-2 bg-green-900/10 rounded p-2">
                                            <span className="text-green-400 font-bold flex-shrink-0">{idx + 1}.</span>
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
