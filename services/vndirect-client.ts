/**
 * Client-side VNDirect API calls
 * Bypasses Next.js API route to avoid 403 Forbidden from VNDirect
 */

import type { StockPriceData, StockPriceResponse } from '@/types/vndirect'

/**
 * Fetch stock prices directly from VNDirect API (client-side)
 * This avoids 403 errors from server-side fetch
 */
export async function fetchStockPricesClient(
  stockCode: string,
  size: number = 150,
  signal?: AbortSignal
): Promise<StockPriceResponse> {
  const url = `https://api-finfo.vndirect.com.vn/v4/stock_prices?sort=date:desc&q=code:${stockCode.toUpperCase()}&size=${size}`

  console.log('🌐 Fetching directly from VNDirect (client-side):', url)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`VNDirect API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('✅ VNDirect direct response:', data.data?.length, 'records')

  return {
    ...data,
    data: (data.data || []).map((item: any) => ({
      date: item.date || '',
      open: Number(item.open) || 0,
      high: Number(item.high) || 0,
      low: Number(item.low) || 0,
      close: Number(item.close) || 0,
      adOpen: Number(item.adOpen || item.open) || 0,
      adHigh: Number(item.adHigh || item.high) || 0,
      adLow: Number(item.adLow || item.low) || 0,
      adClose: Number(item.adClose || item.close) || 0,
      adAverage: Number(item.adAverage) || 0,
      nmVolume: Number(item.nmVolume) || 0,
      nmValue: Number(item.nmValue) || 0,
      ptVolume: Number(item.ptVolume) || 0,
      ptValue: Number(item.ptValue) || 0,
      change: Number(item.change) || 0,
      pctChange: Number(item.pctChange) || 0,
      adChange: Number(item.adChange || item.change) || 0,
      code: String(item.code || '').toUpperCase(),
    }))
  }
}
