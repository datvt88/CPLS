import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * News Search API
 * Searches for latest news about a stock symbol using Google News
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Searching news for symbol:', symbol)

    // Use Google News RSS feed or a news API
    // For Vietnamese stocks, we'll search for both the symbol and common company names
    const searchQuery = encodeURIComponent(`${symbol} cổ phiếu chứng khoán`)

    // Try to fetch from Google News RSS
    const rssUrl = `https://news.google.com/rss/search?q=${searchQuery}&hl=vi&gl=VN&ceid=VN:vi`

    try {
      const newsResponse = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(8000)
      })

      if (!newsResponse.ok) {
        throw new Error(`News fetch failed: ${newsResponse.status}`)
      }

      const rssText = await newsResponse.text()

      // Parse RSS XML to extract articles
      const articles = parseRSSFeed(rssText)

      console.log('📰 Found', articles.length, 'news articles for', symbol)

      return NextResponse.json({
        symbol,
        articles: articles.slice(0, 10), // Limit to 10 most recent
        fetchedAt: new Date().toISOString()
      })
    } catch (fetchError) {
      console.warn('⚠️ Failed to fetch from Google News, returning empty:', fetchError)

      // Return empty articles if news fetch fails
      return NextResponse.json({
        symbol,
        articles: [],
        fetchedAt: new Date().toISOString(),
        error: 'Failed to fetch news'
      })
    }
  } catch (error) {
    console.error('❌ Error in news search API:', error)
    return NextResponse.json(
      { error: 'Failed to search news' },
      { status: 500 }
    )
  }
}

/**
 * Parse RSS feed XML and extract article information
 */
function parseRSSFeed(rssText: string): Array<{ title: string; link: string; pubDate: string; source?: string }> {
  const articles: Array<{ title: string; link: string; pubDate: string; source?: string }> = []

  try {
    // Simple regex-based XML parsing (could use a proper XML parser library for production)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/
    const linkRegex = /<link>(.*?)<\/link>/
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/
    const sourceRegex = /<source.*?>(.*?)<\/source>/

    let match
    while ((match = itemRegex.exec(rssText)) !== null) {
      const itemContent = match[1]

      const titleMatch = titleRegex.exec(itemContent)
      const linkMatch = linkRegex.exec(itemContent)
      const pubDateMatch = pubDateRegex.exec(itemContent)
      const sourceMatch = sourceRegex.exec(itemContent)

      if (titleMatch && linkMatch && pubDateMatch) {
        articles.push({
          title: titleMatch[1].trim(),
          link: linkMatch[1].trim(),
          pubDate: pubDateMatch[1].trim(),
          source: sourceMatch ? sourceMatch[1].trim() : undefined
        })
      }
    }
  } catch (parseError) {
    console.error('Error parsing RSS feed:', parseError)
  }

  return articles
}
