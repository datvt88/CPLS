export type SignalType = 'BUY' | 'SELL' | 'HOLD'

export interface SignalOutput {
  signal: SignalType
  confidence: number
  summary: string
  model?: string
}

export interface SignalError {
  error: string
  model?: string
  details?: string
}

export type SignalResponse = SignalOutput | SignalError
