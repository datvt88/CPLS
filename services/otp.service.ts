import { createClient } from '@supabase/supabase-js'

/**
 * OTP Service for managing Zalo ZNS verification codes
 * Requires SUPABASE_SERVICE_ROLE_KEY for server-side operations
 */

interface OTPRecord {
  id: string
  phone_number: string
  otp_code: string
  expires_at: string
  verified: boolean
  created_at: string
}

/**
 * Create Supabase admin client (server-side only)
 */
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials not configured for OTP service')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export const otpService = {
  /**
   * Store OTP code for a phone number
   * Replaces any existing OTP for the same phone number
   */
  async storeOTP(phoneNumber: string, otpCode: string, expiresInMinutes: number = 5) {
    try {
      const supabase = getSupabaseAdmin()
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

      // Upsert: replace existing OTP if phone number already exists
      const { data, error } = await supabase
        .from('otp_codes')
        .upsert(
          {
            phone_number: phoneNumber,
            otp_code: otpCode,
            expires_at: expiresAt.toISOString(),
            verified: false,
          },
          {
            onConflict: 'phone_number',
          }
        )
        .select()
        .single()

      if (error) {
        console.error('Error storing OTP:', error)
        throw error
      }

      return { success: true, data }
    } catch (error) {
      console.error('OTP storage failed:', error)
      return { success: false, error }
    }
  },

  /**
   * Verify OTP code for a phone number
   * Returns true if valid and not expired, false otherwise
   */
  async verifyOTP(phoneNumber: string, otpCode: string) {
    try {
      const supabase = getSupabaseAdmin()

      // Get OTP record
      const { data, error } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('otp_code', otpCode)
        .single()

      if (error || !data) {
        console.log('OTP not found or invalid:', { phoneNumber, error })
        return { valid: false, error: 'Invalid OTP code' }
      }

      const otpRecord = data as OTPRecord

      // Check if already verified
      if (otpRecord.verified) {
        return { valid: false, error: 'OTP has already been used' }
      }

      // Check if expired
      const now = new Date()
      const expiresAt = new Date(otpRecord.expires_at)

      if (now > expiresAt) {
        return { valid: false, error: 'OTP has expired' }
      }

      // Mark as verified
      await supabase
        .from('otp_codes')
        .update({ verified: true })
        .eq('phone_number', phoneNumber)

      return { valid: true }
    } catch (error) {
      console.error('OTP verification failed:', error)
      return { valid: false, error: 'Verification failed' }
    }
  },

  /**
   * Delete OTP record for a phone number
   */
  async deleteOTP(phoneNumber: string) {
    try {
      const supabase = getSupabaseAdmin()

      const { error } = await supabase
        .from('otp_codes')
        .delete()
        .eq('phone_number', phoneNumber)

      if (error) {
        console.error('Error deleting OTP:', error)
        return { success: false, error }
      }

      return { success: true }
    } catch (error) {
      console.error('OTP deletion failed:', error)
      return { success: false, error }
    }
  },

  /**
   * Cleanup expired OTPs
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpired() {
    try {
      const supabase = getSupabaseAdmin()

      const { error } = await supabase
        .from('otp_codes')
        .delete()
        .lt('expires_at', new Date().toISOString())

      if (error) {
        console.error('Error cleaning up expired OTPs:', error)
        return { success: false, error }
      }

      return { success: true }
    } catch (error) {
      console.error('OTP cleanup failed:', error)
      return { success: false, error }
    }
  },

  /**
   * Get OTP info (for debugging - remove in production)
   */
  async getOTPInfo(phoneNumber: string) {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('This method is only available in development')
    }

    try {
      const supabase = getSupabaseAdmin()

      const { data, error } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single()

      if (error) {
        return { found: false }
      }

      return {
        found: true,
        otp_code: data.otp_code,
        expires_at: data.expires_at,
        verified: data.verified,
      }
    } catch (error) {
      return { found: false }
    }
  },
}
