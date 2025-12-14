'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts'
import { profileService, type Profile as BaseProfile } from '@/services/profile.service'
import ProtectedRoute from '@/components/ProtectedRoute'
import DeviceManagement from '@/components/DeviceManagement'
import PasswordManagement from '@/components/PasswordManagement'

// --- FIX LỖI TYPE: Sử dụng Intersection Type thay vì interface extends ---
type Profile = BaseProfile & {
  role?: string | null; 
}

function ProfilePageContent() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTCBS, setSavingTCBS] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [message, setMessage] = useState('')
  const [tcbsMessage, setTCBSMessage] = useState('')

  // User Info Form fields
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [stockAccountNumber, setStockAccountNumber] = useState('')

  // TCBS fields
  const [tcbsApiKey, setTCBSApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [user])

  const loadProfile = async () => {
    try {
      if (!user) {
        setLoading(false)
        return
      }

      const { profile: userProfile, error } = await profileService.getProfile(user.id)
      if (error) {
        console.error('Error loading profile:', error)
        setMessage('Không thể tải thông tin')
      } else if (userProfile) {
        // Ép kiểu an toàn
        setProfile(userProfile as unknown as Profile)
        setFullName(userProfile.full_name || '')
        setNickname(userProfile.nickname || '')
        setPhoneNumber(userProfile.phone_number || '')
        setStockAccountNumber(userProfile.stock_account_number || '')
        setTCBSApiKey(userProfile.tcbs_api_key || '')
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Đã xảy ra lỗi')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleSubmitUserInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setSaving(true)

    try {
      if (!user) return

      const { error } = await profileService.updateProfile(user.id, {
        full_name: fullName.trim() || undefined,
        nickname: nickname.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        stock_account_number: stockAccountNumber.trim() || undefined,
      })

      if (error) {
        setMessage('Lỗi khi cập nhật: ' + error.message)
      } else {
        setMessage('Cập nhật thành công!')
        await loadProfile()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage('Đã xảy ra lỗi khi cập nhật')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitTCBS = async (e: React.FormEvent) => {
    e.preventDefault()
    setTCBSMessage('')
    setSavingTCBS(true)

    try {
      if (!user) return

      if (!tcbsApiKey.trim()) {
        setTCBSMessage('Vui lòng nhập API Key')
        setSavingTCBS(false)
        return
      }

      const { error } = await profileService.updateTCBSApiKey(user.id, tcbsApiKey.trim())

      if (error) {
        setTCBSMessage('Lỗi khi lưu API Key: ' + error.message)
      } else {
        setTCBSMessage('Lưu API Key thành công!')
        await loadProfile()
      }
    } catch (error) {
      console.error('Error saving TCBS API key:', error)
      setTCBSMessage('Đã xảy ra lỗi khi lưu')
    } finally {
      setSavingTCBS(false)
    }
  }

  const handleRemoveTCBS = async () => {
    if (!confirm('Bạn có chắc muốn xóa kết nối TCBS?')) return

    setTCBSMessage('')
    setSavingTCBS(true)

    try {
      if (!user) return

      const { error } = await profileService.removeTCBSApiKey(user.id)

      if (error) {
        setTCBSMessage('Lỗi khi xóa: ' + error.message)
      } else {
        setTCBSMessage('Đã xóa kết nối TCBS')
        setTCBSApiKey('')
        await loadProfile()
      }
    } catch (error) {
      console.error('Error removing TCBS:', error)
      setTCBSMessage('Đã xảy ra lỗi')
    } finally {
      setSavingTCBS(false)
    }
  }

  const getMembershipBadge = () => {
    if (!profile) return null

    const isPremium = profile.membership === 'premium'
    const badgeClass = isPremium
      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
      : 'bg-gray-700 text-gray-300 border border-gray-600'

    let expiryText = ''
    if (isPremium && profile.membership_expires_at) {
      const expiryDate = new Date(profile.membership_expires_at)
      const isExpired = expiryDate < new Date()
      if (!isExpired) {
        expiryText = ` (đến ${expiryDate.toLocaleDateString('vi-VN')})`
      }
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${badgeClass}`}>
        {isPremium ? 'PRO MEMBER' : 'FREE'}{expiryText}
      </span>
    )
  }

  // Hàm hiển thị huy hiệu Role (Admin/Mod)
  const getRoleBadge = () => {
    if (!profile || !profile.role) return null;

    // Ép kiểu về string để so sánh an toàn
    const role = String(profile.role).toLowerCase();

    if (role === 'admin' || role === 'administrator') {
      return (
        <span className="ml-2 px-2 py-0.5 rounded animate-pulse text-[10px] font-extrabold uppercase bg-red-600 text-white border border-red-400 shadow-sm shadow-red-500/50 tracking-wider">
          ADMIN
        </span>
      );
    }

    if (role === 'mod' || role === 'moderator') {
      return (
        <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-blue-600 text-white border border-blue-400 shadow-sm shadow-blue-500/50 tracking-wider">
          MOD
        </span>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00C805] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 font-medium">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#121212] p-4 sm:p-8 text-white font-sans">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cài đặt tài khoản</h1>
          {getMembershipBadge()}
        </div>

        {/* Section 1: Thông tin người dùng */}
        <div className="bg-[#1E1E1E] rounded-xl shadow-2xl p-6 sm:p-8 border border-[#2C2C2C]">
          <h2 className="text-xl font-bold mb-6 text-white border-b border-[#2C2C2C] pb-4">
            Thông Tin Hồ Sơ
          </h2>

          {/* Avatar Section */}
          <div className="flex items-center gap-5 mb-8">
            <div className="relative group cursor-pointer">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-4 border-[#2C2C2C] group-hover:border-[#00C805] transition-all"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#2C2C2C] flex items-center justify-center text-white text-3xl font-bold border-4 border-[#1E1E1E] group-hover:border-[#00C805] transition-all">
                  {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="absolute bottom-0 right-0 bg-[#00C805] p-1.5 rounded-full border-2 border-[#1E1E1E]">
                <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
              </div>
            </div>
            
            <div>
              <div className="flex items-center flex-wrap">
                  <p className="text-white font-semibold text-lg mr-1">{profile?.email}</p>
                  {getRoleBadge()}
              </div>
              <p className="text-gray-500 text-sm mt-1">Thành viên từ {profile?.created_at ? new Date(profile.created_at).getFullYear() : '...'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmitUserInfo} className="space-y-5">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-gray-400 text-sm font-semibold mb-2">Họ và Tên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-3 bg-[#2C2C2C] border border-transparent rounded-lg focus:outline-none focus:border-[#00C805] focus:bg-[#333] text-white transition-all placeholder-gray-600"
                  placeholder="Nhập họ tên"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-semibold mb-2">Nickname</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full p-3 bg-[#2C2C2C] border border-transparent rounded-lg focus:outline-none focus:border-[#00C805] focus:bg-[#333] text-white transition-all placeholder-gray-600"
                  placeholder="Tên hiển thị"
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-semibold mb-2">Số điện thoại</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full p-3 bg-[#2C2C2C] border border-transparent rounded-lg focus:outline-none focus:border-[#00C805] focus:bg-[#333] text-white transition-all placeholder-gray-600"
                placeholder="Nhập số điện thoại"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-semibold mb-2">Số tài khoản chứng khoán</label>
              <input
                type="text"
                value={stockAccountNumber}
                onChange={(e) => setStockAccountNumber(e.target.value)}
                className="w-full p-3 bg-[#2C2C2C] border border-transparent rounded-lg focus:outline-none focus:border-[#00C805] focus:bg-[#333] text-white transition-all placeholder-gray-600"
                placeholder="Nhập Sổ TKCK"
                disabled={saving}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-4 w-full sm:w-auto px-8 bg-[#00C805] hover:bg-[#00b304] text-black font-bold py-3 rounded-lg transition-all shadow-[0_4px_14px_0_rgba(0,200,5,0.39)] hover:shadow-[0_6px_20px_rgba(0,200,5,0.23)] hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Lưu Thay Đổi
                </>
              )}
            </button>

            {message && (
              <div
                className={`mt-4 p-3 rounded-lg text-center text-sm font-medium ${
                  message.includes('thành công')
                    ? 'bg-green-900/30 text-green-400 border border-green-800'
                    : 'bg-red-900/30 text-red-400 border border-red-800'
                }`}
              >
                {message}
              </div>
            )}
          </form>
        </div>

        {/* Section 2: Gói đăng ký */}
        <div className="bg-[#1E1E1E] rounded-xl shadow-xl p-6 sm:p-8 border border-[#2C2C2C]">
          <h2 className="text-xl font-bold mb-4 text-white">Gói dịch vụ</h2>
          <div className="p-4 bg-[#2C2C2C] rounded-lg border border-[#3E3E3E] flex items-center justify-between">
             <div>
                <p className="text-gray-300 font-medium">Trạng thái hiện tại</p>
                <p className={`text-lg font-bold ${profile?.membership === 'premium' ? 'text-purple-400' : 'text-gray-400'}`}>
                   {profile?.membership === 'premium' ? 'Thành viên PREMIUM' : 'Thành viên Miễn phí'}
                </p>
             </div>
             {profile?.membership !== 'premium' && (
                <button onClick={() => router.push('/upgrade')} className="px-4 py-2 bg-[#333] hover:bg-[#444] text-white text-sm font-semibold rounded border border-gray-600 transition-colors">
                   Nâng cấp
                </button>
             )}
          </div>
        </div>

        <PasswordManagement />
        
        <div className="bg-[#1E1E1E] rounded-xl shadow-xl p-6 sm:p-8 border border-[#2C2C2C]">
           <h2 className="text-xl font-bold mb-4 text-white">Kết nối TCBS</h2>
           <form onSubmit={handleSubmitTCBS} className="space-y-4">
              <div>
                 <label className="block text-gray-400 text-sm font-semibold mb-2">API Key</label>
                 <input 
                    type={showApiKey ? "text" : "password"}
                    value={tcbsApiKey}
                    onChange={(e) => setTCBSApiKey(e.target.value)}
                    className="w-full p-3 bg-[#2C2C2C] border border-transparent rounded-lg focus:outline-none focus:border-[#00C805] text-white placeholder-gray-600"
                    placeholder="Nhập API Key"
                 />
              </div>
              <button 
                 type="submit"
                 disabled={savingTCBS}
                 className="px-6 py-2.5 bg-[#333] hover:bg-[#444] text-white font-semibold rounded-lg border border-gray-600 transition-all w-full sm:w-auto"
              >
                 {savingTCBS ? 'Đang lưu...' : 'Cập nhật Key'}
              </button>
              {tcbsMessage && <p className="text-sm text-gray-400 mt-2">{tcbsMessage}</p>}
           </form>
        </div>

        <DeviceManagement />

        {/* Section: Đăng xuất */}
        <div className="bg-[#1E1E1E] rounded-xl shadow-xl p-6 sm:p-8 border border-[#2C2C2C]">
          <h2 className="text-xl font-bold mb-4 text-white">Phiên đăng nhập</h2>
          <p className="text-gray-400 text-sm mb-4">
            Đăng xuất khỏi tài khoản trên thiết bị này. Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng.
          </p>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 
                       text-white font-semibold rounded-lg 
                       transition-all duration-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {isLoggingOut ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Đang đăng xuất...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Đăng xuất
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  )
}
