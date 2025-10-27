import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker') || 'VNINDEX'

  // Gọi Gemini API (Google AI)
  const geminiResponse = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are an expert Vietnamese stock trading assistant. Analyze the stock ${ticker} and give a concise signal: BUY, SELL, or HOLD, with one-sentence reasoning.`
              }
            ]
          }
        ]
      })
    }
  )

  const data = await geminiResponse.json()
  const signal =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    'No signal returned from Gemini.'

  return NextResponse.json({ ticker, signal })
}
