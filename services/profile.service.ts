import { supabase } from '@/lib/supabaseClient'

export interface Profile {
  id: string
  email: string
  role: 'user' | 'vip'
  created_at: string
}

export interface CreateProfileData {
  id: string
  email: string
  role?: 'user' | 'vip'
  created_at?: string
}

export const profileService = {
  /**
   * Get profile by user ID
   */
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return { profile: data as Profile | null, error }
  },

  /**
   * Create or update profile
   */
  async upsertProfile(profileData: CreateProfileData) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: profileData.id,
          email: profileData.email,
          role: profileData.role || 'user',
          created_at: profileData.created_at || new Date().toISOString()
        },
        { onConflict: 'id' }
      )

    return { data, error }
  },

  /**
   * Check if user has VIP role
   */
  async isVIP(userId: string) {
    const { profile, error } = await this.getProfile(userId)
    if (error || !profile) return false
    return profile.role === 'vip'
  },

  /**
   * Update user role
   */
  async updateRole(userId: string, role: 'user' | 'vip') {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)

    return { data, error }
  }
}
