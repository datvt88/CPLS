'use client'

import { useState, useEffect } from 'react'
import { useStockAnalysis } from '@/contexts/StockAnalysisContext'
import type { StockNews } from '@/app/api/news/stock/route'

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
    newsAnalysis?: {
        sentiment: 'positive' | 'negative' | 'neutral'
        summary: string
        impactOnPrice: string
    }
    rawText?: string
}

export default function GeminiDeepAnalysisWidget({ symbol }: GeminiDeepAnalysisWidgetProps) {
    const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(null)
    const [news, setNews] = useState<StockNews[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingNews, setLoadingNews] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasAnalyzed, setHasAnalyzed] = useState(false)
    const [lastAnalyzedSymbol, setLastAnalyzedSymbol] = useState<string | null>(null)

    // Get data from context
    const { data: contextData, isDataFresh } = useStockAnalysis()

    // Reset when symbol changes
    useEffect(() => {
        if (symbol !== lastAnalyzedSymbol) {
            setGeminiAnalysis(null)
            setNews([])
            setHasAnalyzed(false)
            setError(null)
        }
    }, [symbol, lastAnalyzedSymbol])

    const handleAnalyze = async () => {
        if (!symbol) return

        setLoading(true)
        setError(null)
        setGeminiAnalysis(null)
        setNews([])

        try {
            console.log('🤖 Starting Gemini Deep Analysis for:', symbol)

            // Check if we have data from context
            let technicalData = contextData?.technicalData
            let fundamentalData = contextData?.fundamentalData
            let recommendations = contextData?.recommendations

            // If context data is not available or not fresh, show error
            if (!technicalData || !contextData || contextData.symbol !== symbol) {
                console.log('⚠️ No context data available, waiting for StockSummaryWidget to load data...')
                throw new Error('Đang chờ dữ liệu từ widget tổng hợp đánh giá. Vui lòng đợi vài giây và thử lại.')
            }

            console.log('📊 Using data from context for:', symbol, {
                hasTechnical: !!technicalData,
                hasFundamental: !!fundamentalData,
                recommendationsCount: recommendations?.length || 0
            })

            // Fetch news in parallel with preparing data
            setLoadingNews(true)
            const newsPromise = fetchStockNews(symbol)

            // Wait for news
            const fetchedNews = await newsPromise
            setNews(fetchedNews)
            setLoadingNews(false)

            console.log('📰 Fetched', fetchedNews.length, 'news articles for:', symbol)

            // Call Gemini API with context data + news
            const result = await callGeminiAnalysis(
                symbol,
                technicalData,
                fundamentalData,
                recommendations || [],
                fetchedNews
            )

            if (result) {
                console.log('✅ Gemini analysis completed for:', symbol, result)
                setGeminiAnalysis(result)
                setHasAnalyzed(true)
                setLastAnalyzedSymbol(symbol)
            } else {
                console.error('❌ Gemini analysis returned null for:', symbol)
                throw new Error('Không nhận được kết quả phân tích từ Gemini. Vui lòng thử lại.')
            }
        } catch (err: any) {
            console.error('❌ Error performing Gemini analysis:', err)
            setLoadingNews(false)
            const errorMessage = err.message || 'Không thể thực hiện phân tích Gemini'
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }

    const fetchStockNews = async (symbol: string): Promise<StockNews[]> => {
        try {
            const response = await fetch('/api/news/stock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ symbol })
            })

            if (!response.ok) {
                console.warn('⚠️ Failed to fetch news, continuing without')
                return []
            }

            const data = await response.json()
            return data.news || []
        } catch (error) {
            console.warn('⚠️ News fetch error:', error)
            return []
        }
    }

    const callGeminiAnalysis = async (
        symbol: string,
        technicalData: any,
        fundamentalData: any,
        recommendations: any[],
        news: StockNews[]
    ): Promise<GeminiAnalysis | null> => {
        // Call Gemini API with timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 45000) // 45 second timeout (longer due to news)

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
                    recommendations,
                    news  // Include news in the request
                }),
                signal: controller.signal
            })

            clearTimeout(timeoutId)

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                console.error('❌ API response not ok:', response.status, errorData)
                throw new Error(errorData.error || `Lỗi API Gemini: ${response.status}`)
            }

            const data = await response.json()

            console.log('📥 Gemini API response:', JSON.stringify(data).substring(0, 500))

            // Validate response structure - accept partial results
            if (!data) {
                console.error('Empty response from Gemini API')
                throw new Error('Không nhận được dữ liệu từ Gemini')
            }

            // Check for error in response
            if (data.error) {
                console.error('Gemini API error:', data.error)
                throw new Error(data.error)
            }

            // Check if we have at least some valid data
            // Also check if we got default values (signal = 'THEO DÕI' and confidence = 50)
            const isDefaultResponse =
                data.shortTerm?.signal === 'THEO DÕI' &&
                data.shortTerm?.confidence === 50 &&
                data.longTerm?.signal === 'THEO DÕI' &&
                data.longTerm?.confidence === 50 &&
                data.shortTerm?.summary?.includes('theo dõi')

            if (isDefaultResponse) {
                console.warn('⚠️ Got default response from Gemini - API may have issues')
            }

            if (!data.shortTerm && !data.longTerm && !data.risks && !data.opportunities) {
                console.error('Invalid Gemini response structure:', data)
                throw new Error('Định dạng phản hồi từ Gemini không hợp lệ')
            }

            return data as GeminiAnalysis
        } catch (fetchError: any) {
            clearTimeout(timeoutId)
            if (fetchError.name === 'AbortError') {
                throw new Error('Yêu cầu đã hết thời gian chờ (45 giây). Vui lòng thử lại.')
            }
            throw fetchError
        }
    }

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return 'text-green-400'
            case 'negative': return 'text-red-400'
            default: return 'text-amber-400'
        }
    }

    const getSentimentLabel = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return 'Tích cực'
            case 'negative': return 'Tiêu cực'
            default: return 'Trung lập'
        }
    }

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return '📈'
            case 'negative': return '📉'
            default: return '➡️'
        }
    }

    // Check if context data is available for this symbol
    const hasContextData = contextData && contextData.symbol === symbol && contextData.technicalData

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
                        <p className="text-xs text-gray-500 mb-2">
                            Phân tích bao gồm: Kỹ thuật, Cơ bản, Tin tức, Rủi ro, Cơ hội và Khuyến nghị giá
                        </p>
                        {!hasContextData && (
                            <p className="text-xs text-amber-400 mb-4">
                                ⏳ Đang chờ dữ liệu từ widget "Tổng hợp đánh giá"...
                            </p>
                        )}
                        {hasContextData && (
                            <p className="text-xs text-green-400 mb-4">
                                ✅ Dữ liệu sẵn sàng - Sử dụng dữ liệu đã tải (không fetch lại)
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleAnalyze}
                        disabled={!hasContextData}
                        className={`px-6 py-3 font-semibold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2 mx-auto ${
                            hasContextData
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
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
                        <p className="text-gray-400 text-sm">
                            {loadingNews ? 'Đang tìm kiếm tin tức...' : 'AI đang phân tích dữ liệu kỹ thuật, cơ bản và tin tức...'}
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                    <p className="text-red-400 mb-3">{error}</p>
                    <button
                        onClick={handleAnalyze}
                        disabled={!hasContextData}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors disabled:opacity-50"
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

                    {/* News Analysis Section */}
                    {geminiAnalysis.newsAnalysis && (
                        <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700/30 mb-4">
                            <h5 className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                                📰 Phân tích Tin tức
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                                <div className="bg-blue-900/30 rounded-lg p-3">
                                    <div className="text-xs text-gray-400 mb-1">Sentiment</div>
                                    <div className={`text-lg font-bold ${getSentimentColor(geminiAnalysis.newsAnalysis.sentiment)}`}>
                                        {getSentimentIcon(geminiAnalysis.newsAnalysis.sentiment)} {getSentimentLabel(geminiAnalysis.newsAnalysis.sentiment)}
                                    </div>
                                </div>
                                <div className="bg-blue-900/30 rounded-lg p-3 sm:col-span-2">
                                    <div className="text-xs text-gray-400 mb-1">Tác động đến giá</div>
                                    <div className="text-sm text-gray-300">{geminiAnalysis.newsAnalysis.impactOnPrice}</div>
                                </div>
                            </div>
                            <div className="text-sm text-gray-300 leading-relaxed">
                                {geminiAnalysis.newsAnalysis.summary}
                            </div>
                        </div>
                    )}

                    {/* News List */}
                    {news.length > 0 && (
                        <div className="bg-slate-900/30 rounded-lg p-4 border border-slate-700/30 mb-4">
                            <h5 className="font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                🗞️ Tin tức liên quan ({news.length})
                            </h5>
                            <div className="space-y-2">
                                {news.map((item, idx) => (
                                    <div key={idx} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/20">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <h6 className="text-sm font-medium text-white mb-1">{item.title}</h6>
                                                <p className="text-xs text-gray-400 mb-2">{item.summary}</p>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-gray-500">{item.source}</span>
                                                    <span className="text-gray-600">•</span>
                                                    <span className="text-gray-500">{item.date}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`px-2 py-0.5 rounded text-xs ${
                                                    item.sentiment === 'positive' ? 'bg-green-900/50 text-green-400' :
                                                    item.sentiment === 'negative' ? 'bg-red-900/50 text-red-400' :
                                                    'bg-amber-900/50 text-amber-400'
                                                }`}>
                                                    {getSentimentLabel(item.sentiment)}
                                                </span>
                                                <span className={`text-xs ${
                                                    item.relevance === 'high' ? 'text-blue-400' :
                                                    item.relevance === 'low' ? 'text-gray-500' : 'text-gray-400'
                                                }`}>
                                                    {item.relevance === 'high' ? 'Liên quan cao' :
                                                     item.relevance === 'low' ? 'Liên quan thấp' : 'Liên quan vừa'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                            disabled={loading || !hasContextData}
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
