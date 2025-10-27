import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker') || 'VNINDEX'

  // Gọi AI model (DeepSeek / ChatGPT)
  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an expert Vietnamese stock trading assistant. Provide BUY, SELL, or HOLD signals briefly." },
        { role: "user", content: `Analyze ${ticker} and give a short recommendation.` }
      ]
    })
  })

  const data = await aiResponse.json()
  const signal = data.choices?.[0]?.message?.content || "No signal"

  return NextResponse.json({ ticker, signal })
}