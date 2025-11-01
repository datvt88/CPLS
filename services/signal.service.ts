import { supabase } from '@/lib/supabaseClient'
import { SignalType } from '@/types/signal'

export interface Signal {
  id: string
  ticker: string
  signal: SignalType
  confidence: number
  created_at: string
}

export interface CreateSignalData {
  ticker: string
  signal: SignalType
  confidence: number
}

export const signalService = {
  /**
   * Get all signals
   */
  async getSignals(limit = 50) {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    return { signals: data as Signal[] | null, error }
  },

  /**
   * Get signals for a specific ticker
   */
  async getSignalsByTicker(ticker: string, limit = 10) {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .eq('ticker', ticker)
      .order('created_at', { ascending: false })
      .limit(limit)

    return { signals: data as Signal[] | null, error }
  },

  /**
   * Create a new signal
   */
  async createSignal(signalData: CreateSignalData) {
    const { data, error } = await supabase
      .from('signals')
      .insert([signalData])
      .select()
      .single()

    return { signal: data as Signal | null, error }
  },

  /**
   * Get latest signal for a ticker
   */
  async getLatestSignal(ticker: string) {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .eq('ticker', ticker)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return { signal: data as Signal | null, error }
  }
}
