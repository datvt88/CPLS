'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabaseClient'

// Subscription plan types
interface SubscriptionPlan {
  id: string
  name: string
  price: number
  duration: number // in days
  features: string[]
  isPopular?: boolean
}

// Available subscription plans
const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Gói Tháng',
    price: 99000,
    duration: 30,
    features: [
      'Phân tích AI không giới hạn',
      'Tín hiệu Golden Cross real-time',
      'Biểu đồ kỹ thuật nâng cao',
      'Hỗ trợ ưu tiên qua chat',
    ],
  },
  {
    id: 'quarterly',
    name: 'Gói Quý',
    price: 249000,
    duration: 90,
    features: [
      'Tất cả tính năng gói Tháng',
      'Giảm giá 16%',
      'Báo cáo phân tích hàng tuần',
      'API access (coming soon)',
    ],
    isPopular: true,
  },
  {
    id: 'yearly',
    name: 'Gói Năm',
    price: 799000,
    duration: 365,
    features: [
      'Tất cả tính năng gói Quý',
      'Giảm giá 33%',
      'Tư vấn cá nhân 1-1',
      'Early access tính năng mới',
    ],
  },
]

// Format price to VND
const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price)
}

// Format expiry date
const formatExpiryDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Không giới hạn'
  const date = new Date(dateString)
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Calculate remaining days
const getRemainingDays = (expiryDate: string | null | undefined): number | null => {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate)
  const now = new Date()
  const diffTime = expiry.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function UpgradePageContent() {
  const router = useRouter()
  const { isPremium, userId, refresh } = usePermissions()
  const [selectedPlan, setSelectedPlan] = useState<string>('quarterly')
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState<{ membership: string; membership_expires_at: string | null } | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load current subscription status
  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) return
      
      const { data, error } = await supabase
        .from('profiles')
        .select('membership, membership_expires_at')
        .eq('id', userId)
        .single()
      
      if (!error && data) {
        setProfile(data)
      }
    }
    
    loadProfile()
  }, [userId])

  // Handle plan selection
  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
    setMessage(null)
  }

  // Handle subscription purchase (mock - would integrate with payment gateway)
  const handlePurchase = async () => {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)
    if (!plan || !userId) return

    setIsLoading(true)
    setMessage(null)

    try {
      // Calculate expiry date
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + plan.duration)

      // In a real app, this would:
      // 1. Create a payment session with payment gateway (e.g., VNPay, Momo)
      // 2. Redirect user to payment page
      // 3. Handle webhook callback on successful payment
      // 4. Update membership in database

      // For now, show contact information
      setMessage({
        type: 'success',
        text: `Vui lòng liên hệ Admin để nâng cấp gói ${plan.name}. Giá: ${formatPrice(plan.price)}`
      })
      
    } catch (error) {
      console.error('Purchase error:', error)
      setMessage({
        type: 'error',
        text: 'Có lỗi xảy ra. Vui lòng thử lại sau.'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const remainingDays = profile?.membership_expires_at ? getRemainingDays(profile.membership_expires_at) : null
  const isExpiringSoon = remainingDays !== null && remainingDays <= 7 && remainingDays > 0
  const isExpired = remainingDays !== null && remainingDays <= 0

  return (
    <div className="min-h-screen bg-[#121212] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Nâng cấp Premium
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Truy cập đầy đủ các tính năng phân tích AI và tín hiệu giao dịch thời gian thực
          </p>
        </div>

        {/* Current Subscription Status */}
        {isPremium && profile && (
          <div className={`mb-8 p-6 rounded-xl border ${
            isExpired 
              ? 'bg-red-900/20 border-red-500/30' 
              : isExpiringSoon 
                ? 'bg-yellow-900/20 border-yellow-500/30'
                : 'bg-purple-900/20 border-purple-500/30'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">⭐</span>
                  Gói Premium đang hoạt động
                </h3>
                <p className="text-gray-400 mt-1">
                  Hết hạn: {formatExpiryDate(profile.membership_expires_at)}
                  {remainingDays !== null && (
                    <span className={`ml-2 ${
                      isExpired ? 'text-red-400' : isExpiringSoon ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      ({isExpired ? 'Đã hết hạn' : `Còn ${remainingDays} ngày`})
                    </span>
                  )}
                </p>
              </div>
              {(isExpiringSoon || isExpired) && (
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  isExpired 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {isExpired ? 'Cần gia hạn' : 'Sắp hết hạn'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              onClick={() => handleSelectPlan(plan.id)}
              className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                selectedPlan === plan.id
                  ? 'bg-[#1E1E1E] border-purple-500 shadow-lg shadow-purple-500/20'
                  : 'bg-[#1A1A1A] border-[#2C2C2C] hover:border-[#3C3C3C]'
              }`}
            >
              {/* Popular Badge */}
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                    Phổ biến nhất
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6 pt-2">
                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-white">
                    {formatPrice(plan.price)}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  {plan.duration} ngày
                </p>
              </div>

              {/* Features List */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-300 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Selection Indicator */}
              <div className={`w-full py-3 rounded-lg text-center font-semibold transition-colors ${
                selectedPlan === plan.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#2C2C2C] text-gray-400'
              }`}>
                {selectedPlan === plan.id ? 'Đã chọn' : 'Chọn gói này'}
              </div>
            </div>
          ))}
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg text-center ${
            message.type === 'success' 
              ? 'bg-green-900/30 text-green-400 border border-green-500/30'
              : 'bg-red-900/30 text-red-400 border border-red-500/30'
          }`}>
            {message.text}
          </div>
        )}

        {/* Purchase Button */}
        <div className="text-center">
          <button
            onClick={handlePurchase}
            disabled={isLoading}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-bold rounded-xl transition-all shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Đang xử lý...
              </span>
            ) : (
              `Đăng ký ${SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.name}`
            )}
          </button>
          
          <p className="mt-4 text-gray-500 text-sm">
            Thanh toán an toàn • Hỗ trợ 24/7 • Hủy bất cứ lúc nào
          </p>
        </div>

        {/* Contact Support */}
        <div className="mt-12 p-6 bg-[#1E1E1E] rounded-xl border border-[#2C2C2C] text-center">
          <h3 className="text-lg font-bold text-white mb-2">Cần hỗ trợ?</h3>
          <p className="text-gray-400 mb-4">
            Liên hệ với chúng tôi qua các kênh bên dưới để được hỗ trợ nâng cấp tài khoản.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href="mailto:support@cophieluotsong.com"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#2C2C2C] hover:bg-[#3C3C3C] text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
            <a
              href="https://zalo.me/cophieluotsong"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
              Zalo
            </a>
          </div>
        </div>

        {/* Features Comparison */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white text-center mb-8">So sánh tính năng</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2C2C2C]">
                  <th className="py-4 px-4 text-gray-400 font-semibold">Tính năng</th>
                  <th className="py-4 px-4 text-center text-gray-400 font-semibold">Free</th>
                  <th className="py-4 px-4 text-center text-purple-400 font-semibold">Premium</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Xem biểu đồ cơ bản', free: true, premium: true },
                  { feature: 'Tín hiệu Golden Cross', free: false, premium: true },
                  { feature: 'Phân tích AI không giới hạn', free: false, premium: true },
                  { feature: 'Biểu đồ kỹ thuật nâng cao', free: false, premium: true },
                  { feature: 'Báo cáo phân tích', free: false, premium: true },
                  { feature: 'Hỗ trợ ưu tiên', free: false, premium: true },
                ].map((row, index) => (
                  <tr key={index} className="border-b border-[#2C2C2C]">
                    <td className="py-4 px-4 text-white">{row.feature}</td>
                    <td className="py-4 px-4 text-center">
                      {row.free ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {row.premium ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UpgradePage() {
  return (
    <ProtectedRoute>
      <UpgradePageContent />
    </ProtectedRoute>
  )
}
