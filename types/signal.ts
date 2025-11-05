export type SignalType = 'BUY' | 'SELL' | 'HOLD'

export interface SignalOutput {
  signal: SignalType
  confidence: number
  summary: string
}

export interface SignalError {
  error: string
}

export type SignalResponse = SignalOutput | SignalError
