// User and Auth Types
export interface User {
  id: string
  email?: string
  created_at?: string
}

export interface Profile {
  id: string
  email: string | null
  role: 'user' | 'vip' | 'admin'
  plan?: string
  created_at: string
  updated_at?: string
}

// AI Signal Types
export type SignalType = 'BUY' | 'SELL' | 'HOLD'

export interface AISignal {
  signal: SignalType
  confidence: number
  summary: string
  timestamp?: string
}

export interface GeminiRequest {
  prompt: string
  user_id?: string
}

export interface GeminiResponse {
  signal: SignalType
  confidence: number
  summary: string
}

// Chart Types
export interface ChartData {
  time: number
  value: number
}

export interface CandlestickData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// Component Props Types
export interface ProtectedRouteProps {
  children: React.ReactNode
  requireVIP?: boolean
}

export interface ThemeContextType {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}
