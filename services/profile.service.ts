import { supabase } from '@/lib/supabaseClient'

export type MembershipTier = 'free' | 'premium'

export interface Profile {
  id: string
  email: string
  phone_number: string  // BẮT BUỘC: Số điện thoại
  full_name?: string
  nickname?: string  // Tên hiển thị tài khoản (user tự đặt)
  stock_account_number?: string  // Số tài khoản chứng khoán (optional)
  avatar_url?: string
  zalo_id?: string
  birthday?: string  // Ngày sinh từ Zalo (DD/MM/YYYY)
  gender?: 'male' | 'female'  // Giới tính từ Zalo
  membership: MembershipTier
  membership_expires_at?: string
  tcbs_api_key?: string
  tcbs_connected_at?: string
  created_at: string
  updated_at?: string
}

export interface CreateProfileData {
  id: string
  email: string
  phone_number: string  // BẮT BUỘC: Số điện thoại
  full_name?: string
  nickname?: string
  stock_account_number?: string
  avatar_url?: string
  zalo_id?: string
  birthday?: string  // Ngày sinh từ Zalo (DD/MM/YYYY)
  gender?: 'male' | 'female'  // Giới tính từ Zalo
  membership?: MembershipTier
  created_at?: string
}

export interface UpdateProfileData {
  full_name?: string
  nickname?: string
  phone_number?: string
  stock_account_number?: string
  avatar_url?: string
  birthday?: string
  gender?: 'male' | 'female'
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
          full_name: profileData.full_name,
          nickname: profileData.nickname,
          phone_number: profileData.phone_number,
          stock_account_number: profileData.stock_account_number,
          avatar_url: profileData.avatar_url,
          zalo_id: profileData.zalo_id,
          birthday: profileData.birthday,
          gender: profileData.gender,
          membership: profileData.membership || 'free',
          created_at: profileData.created_at || new Date().toISOString()
        },
        { onConflict: 'id' }
      )

    return { data, error }
  },

  /**
   * Update user profile information
   */
  async updateProfile(userId: string, updates: UpdateProfileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    return { profile: data as Profile | null, error }
  },

  /**
   * Check if user has Premium membership
   */
  async isPremium(userId: string) {
    const { profile, error } = await this.getProfile(userId)
    if (error || !profile) return false

    // Check if membership is premium and not expired
    if (profile.membership !== 'premium') return false

    if (profile.membership_expires_at) {
      const expiresAt = new Date(profile.membership_expires_at)
      const now = new Date()
      return expiresAt > now
    }

    // If no expiration date, consider as lifetime premium
    return true
  },

  /**
   * Update user membership
   */
  async updateMembership(
    userId: string,
    membership: MembershipTier,
    expiresAt?: string
  ) {
    const updates: any = { membership }
    if (expiresAt) {
      updates.membership_expires_at = expiresAt
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    return { profile: data as Profile | null, error }
  },

  /**
   * Get profile by Zalo ID
   */
  async getProfileByZaloId(zaloId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('zalo_id', zaloId)
      .single()

    return { profile: data as Profile | null, error }
  },

  /**
   * Link Zalo account to existing profile
   */
  async linkZaloAccount(userId: string, zaloId: string, zaloData?: Partial<Profile>) {
    const updates: any = { zalo_id: zaloId }

    // Optionally update profile with Zalo data
    if (zaloData?.full_name) updates.full_name = zaloData.full_name
    if (zaloData?.nickname) updates.nickname = zaloData.nickname
    if (zaloData?.phone_number) updates.phone_number = zaloData.phone_number
    if (zaloData?.avatar_url) updates.avatar_url = zaloData.avatar_url
    if (zaloData?.birthday) updates.birthday = zaloData.birthday
    if (zaloData?.gender) updates.gender = zaloData.gender

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    return { profile: data as Profile | null, error }
  },

  /**
   * @deprecated Use isPremium instead
   * Check if user has VIP role (for backward compatibility)
   */
  async isVIP(userId: string) {
    return this.isPremium(userId)
  },

  /**
   * @deprecated Use updateMembership instead
   * Update user role (for backward compatibility)
   */
  async updateRole(userId: string, role: 'user' | 'vip') {
    const membership: MembershipTier = role === 'vip' ? 'premium' : 'free'
    return this.updateMembership(userId, membership)
  },

  /**
   * Update TCBS API key
   * Note: In production, this should be encrypted before storage
   */
  async updateTCBSApiKey(userId: string, apiKey: string) {
    const updates: any = {
      tcbs_api_key: apiKey,
      tcbs_connected_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    return { profile: data as Profile | null, error }
  },

  /**
   * Remove TCBS API key
   */
  async removeTCBSApiKey(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        tcbs_api_key: null,
        tcbs_connected_at: null
      })
      .eq('id', userId)
      .select()
      .single()

    return { profile: data as Profile | null, error }
  },

  /**
   * Check if TCBS is connected
   */
  hasTCBSConnected(profile: Profile): boolean {
    return !!profile.tcbs_api_key && !!profile.tcbs_connected_at
  }
}
