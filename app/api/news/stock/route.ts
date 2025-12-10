import { NextRequest, NextResponse } from 'next/server'
import { isValidModel, DEFAULT_GEMINI_MODEL } from '@/lib/geminiModels'

export interface StockNews {
  title: string
  summary: string
  source: string
  date: string
  sentiment: 'positive' | 'negative' | 'neutral'
  relevance: 'high' | 'medium' | 'low'
}

export interface StockNewsResponse {
  symbol: string
  news: StockNews[]
  searchQuery: string
  fetchedAt: string
}

export async function POST(request: NextRequest) {
  try {
    const { symbol, companyName, model } = await request.json()

    // Validate input
    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        { error: 'Invalid symbol' },
        { status: 400 }
      )
    }

    // Validate and set model - prefer models with Google Search capability
    const selectedModel = model && isValidModel(model) ? model : DEFAULT_GEMINI_MODEL
    console.log('🔍 Fetching news for:', symbol, 'using model:', selectedModel)

    // Check if API key exists
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Build search query - include company name if available
    const searchQuery = companyName
      ? `cổ phiếu ${symbol} ${companyName} tin tức mới nhất`
      : `cổ phiếu ${symbol} tin tức thị trường chứng khoán Việt Nam`

    // Build prompt for Gemini to search and analyze news
    const prompt = buildNewsSearchPrompt(symbol, companyName, searchQuery)

    // Try calling Gemini API with Google Search grounding first
    let response: Response
    let useGoogleSearch = true

    try {
      console.log('🔍 Trying Gemini with Google Search grounding...')
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            tools: [
              {
                googleSearch: {}
              }
            ],
            generationConfig: {
              temperature: 0.3,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',  // Force JSON response
            },
          }),
        }
      )

      console.log('📡 Gemini News API (with Google Search) response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.warn('⚠️ Google Search grounding failed:', response.status, errorText)
        useGoogleSearch = false
      }
    } catch (searchError) {
      console.warn('⚠️ Google Search grounding error:', searchError)
      useGoogleSearch = false
    }

    // Fallback to request without Google Search
    if (!useGoogleSearch) {
      console.log('🔄 Falling back to Gemini without Google Search...')
      return await fetchNewsWithoutSearch(apiKey, selectedModel, symbol, companyName, searchQuery)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    if (!generatedText) {
      console.error('No content generated from Gemini for news:', symbol)
      return NextResponse.json(
        { error: 'No news content generated' },
        { status: 500 }
      )
    }

    console.log('📰 Gemini news response length:', generatedText.length)

    // Parse news from response
    const news = parseNewsResponse(generatedText)

    const result: StockNewsResponse = {
      symbol,
      news,
      searchQuery,
      fetchedAt: new Date().toISOString()
    }

    console.log('✅ News fetched for', symbol, ':', news.length, 'articles')

    return NextResponse.json(result)
  } catch (error) {
    console.error('News API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Fallback function to fetch news without Google Search tool
 */
async function fetchNewsWithoutSearch(
  apiKey: string,
  model: string,
  symbol: string,
  companyName: string | undefined,
  searchQuery: string
): Promise<NextResponse> {
  console.log('⚠️ Fetching news without Google Search for:', symbol)

  const fallbackPrompt = buildFallbackNewsPrompt(symbol, companyName)
  console.log('📝 Fallback prompt length:', fallbackPrompt.length)

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fallbackPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.5,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',  // Force JSON response
          },
        }),
      }
    )

    console.log('📡 Fallback news API response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Fallback news API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch news' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('📰 Fallback news response length:', generatedText.length)

    const news = parseNewsResponse(generatedText)

    const result: StockNewsResponse = {
      symbol,
      news,
      searchQuery,
      fetchedAt: new Date().toISOString()
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Fallback news fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}

/**
 * Build prompt for Gemini to search and analyze news
 */
function buildNewsSearchPrompt(symbol: string, companyName: string | undefined, searchQuery: string): string {
  const company = companyName ? `${companyName} (${symbol})` : symbol

  return `Bạn là chuyên gia phân tích tin tức chứng khoán Việt Nam. Hãy tìm kiếm và tóm tắt các tin tức gần đây về cổ phiếu ${company}.

TÌM KIẾM: "${searchQuery}"

YÊU CẦU:
1. Tìm 3-5 tin tức liên quan đến cổ phiếu ${symbol} trong 7 ngày gần nhất
2. Ưu tiên tin từ: CafeF, VnExpress Kinh Doanh, Vietstock, DNSE, VNDirect, SSI, VNEconomy
3. Phân tích sentiment (tích cực/tiêu cực/trung lập) của mỗi tin
4. Đánh giá mức độ liên quan đến cổ phiếu

📋 FORMAT JSON (BẮT BUỘC - chỉ trả về JSON, không có text khác):
{
  "news": [
    {
      "title": "Tiêu đề tin tức",
      "summary": "Tóm tắt ngắn gọn 1-2 câu về nội dung tin",
      "source": "Tên nguồn (CafeF, VnExpress...)",
      "date": "YYYY-MM-DD hoặc 'Hôm nay' hoặc 'Hôm qua'",
      "sentiment": "positive|negative|neutral",
      "relevance": "high|medium|low"
    }
  ]
}

LƯU Ý:
- Chỉ trả về tin thực sự liên quan đến ${symbol}
- Nếu không tìm thấy tin cụ thể, trả về tin về ngành hoặc thị trường chung
- sentiment: "positive" (tích cực), "negative" (tiêu cực), "neutral" (trung lập)
- relevance: "high" (trực tiếp về ${symbol}), "medium" (về ngành), "low" (thị trường chung)`
}

/**
 * Build fallback prompt when Google Search is not available
 */
function buildFallbackNewsPrompt(symbol: string, companyName: string | undefined): string {
  const company = companyName ? `${companyName} (${symbol})` : symbol

  return `Bạn là chuyên gia phân tích chứng khoán Việt Nam. Dựa trên kiến thức của bạn, hãy cung cấp thông tin về các chủ đề tin tức thường gặp liên quan đến cổ phiếu ${company}.

YÊU CẦU:
1. Liệt kê 3-5 chủ đề tin tức phổ biến về loại cổ phiếu này
2. Mỗi chủ đề nên phản ánh các yếu tố có thể ảnh hưởng đến giá cổ phiếu
3. Đánh giá sentiment tiềm năng

📋 FORMAT JSON (BẮT BUỘC):
{
  "news": [
    {
      "title": "Chủ đề tin tức thường gặp",
      "summary": "Mô tả ngắn về loại tin tức này",
      "source": "Phân tích chung",
      "date": "N/A",
      "sentiment": "neutral",
      "relevance": "medium"
    }
  ]
}

LƯU Ý: Đây là các chủ đề tham khảo, không phải tin tức cụ thể từ nguồn.`
}

/**
 * Parse news from Gemini response
 */
function parseNewsResponse(text: string): StockNews[] {
  console.log('🔍 Parsing news response...')
  console.log('📝 News text length:', text.length)
  console.log('📝 News text preview:', text.substring(0, 300))

  // Clean markdown code blocks
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```javascript\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*[\r\n]+/gm, '')
    .trim()

  // Find JSON object
  const startIdx = cleaned.indexOf('{')
  if (startIdx === -1) {
    console.error('❌ No JSON found in news response')
    console.error('📝 Cleaned text:', cleaned.substring(0, 500))
    return getDefaultNews()
  }

  // Find matching closing brace
  let braceCount = 0
  let endIdx = -1
  for (let i = startIdx; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceCount++
    if (cleaned[i] === '}') braceCount--
    if (braceCount === 0) {
      endIdx = i
      break
    }
  }

  if (endIdx === -1) {
    console.error('❌ No closing brace found in news response')
    return getDefaultNews()
  }

  const jsonStr = cleaned.substring(startIdx, endIdx + 1)
  console.log('📝 Extracted news JSON length:', jsonStr.length)

  try {
    // Fix common JSON issues
    let fixedJson = jsonStr
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
      .replace(/'/g, '"')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/\s+/g, ' ')

    const parsed = JSON.parse(fixedJson)
    console.log('✅ News JSON parsed successfully')
    console.log('📊 Parsed news count:', parsed.news?.length || 0)

    if (!parsed.news || !Array.isArray(parsed.news)) {
      console.warn('⚠️ No news array in parsed response')
      return getDefaultNews()
    }

    // Validate and normalize news items
    const news: StockNews[] = parsed.news
      .filter((item: any) => item && item.title)
      .slice(0, 5)
      .map((item: any) => ({
        title: String(item.title || '').trim(),
        summary: String(item.summary || '').trim(),
        source: String(item.source || 'Không rõ nguồn').trim(),
        date: String(item.date || 'N/A').trim(),
        sentiment: normalizeSentiment(item.sentiment),
        relevance: normalizeRelevance(item.relevance)
      }))

    return news.length > 0 ? news : getDefaultNews()
  } catch (error) {
    console.error('❌ News JSON parse failed:', error)
    return getDefaultNews()
  }
}

/**
 * Normalize sentiment value
 */
function normalizeSentiment(sentiment: any): 'positive' | 'negative' | 'neutral' {
  const s = String(sentiment || '').toLowerCase().trim()
  if (s.includes('positive') || s.includes('tích cực')) return 'positive'
  if (s.includes('negative') || s.includes('tiêu cực')) return 'negative'
  return 'neutral'
}

/**
 * Normalize relevance value
 */
function normalizeRelevance(relevance: any): 'high' | 'medium' | 'low' {
  const r = String(relevance || '').toLowerCase().trim()
  if (r.includes('high') || r.includes('cao')) return 'high'
  if (r.includes('low') || r.includes('thấp')) return 'low'
  return 'medium'
}

/**
 * Get default news when parsing fails
 */
function getDefaultNews(): StockNews[] {
  return [
    {
      title: 'Cập nhật thị trường chứng khoán',
      summary: 'Theo dõi diễn biến thị trường để có quyết định đầu tư phù hợp',
      source: 'Phân tích chung',
      date: 'N/A',
      sentiment: 'neutral',
      relevance: 'medium'
    }
  ]
}
