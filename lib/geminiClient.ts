export function parseGeminiResponse(text: string){
  const m = text.match(/\{[\s\S]*\}/)
  if(m){
    try { return JSON.parse(m[0]) }
    catch {}
  }
  if(/BUY|MUA/i.test(text)) return { signal: 'BUY', confidence: 50, summary: text.slice(0,300) }
  if(/SELL|BÁN/i.test(text)) return { signal: 'SELL', confidence: 50, summary: text.slice(0,300) }
  return { signal: 'HOLD', confidence: 50, summary: text.slice(0,300) }
}
