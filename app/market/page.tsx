'use client'

import { useState } from 'react'
import SimpleSecuritiesWidget from '@/components/market/SimpleSecuritiesWidget'
import SimpleTopGainersWidget from '@/components/market/SimpleTopGainersWidget'
import SimpleWorldIndicesWidget from '@/components/market/SimpleWorldIndicesWidget'
import SimpleCommoditiesWidget from '@/components/market/SimpleCommoditiesWidget'
import SimpleExchangeRateWidget from '@/components/market/SimpleExchangeRateWidget'

type TabType = 'securities' | 'world' | 'commodities' | 'exchange'

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'securities', label: 'Chứng khoán', icon: '📊' },
  { id: 'world', label: 'Thế giới', icon: '🌍' },
  { id: 'commodities', label: 'Hàng hóa', icon: '🛢️' },
  { id: 'exchange', label: 'Tỷ giá', icon: '💱' },
]

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<TabType>('securities')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h1 className="text-3xl font-bold text-white mb-2">🌐 Thị trường</h1>
        <p className="text-[--muted]">
          Thông tin thị trường chứng khoán và tài chính (dữ liệu mẫu)
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-[--panel] rounded-xl p-4 border border-gray-800">
        <div className="overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all
                  ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <span className="text-xl">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 text-sm text-gray-400">
          Chọn tab để xem các chỉ số khác nhau
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'securities' && (
          <>
            <SimpleSecuritiesWidget />
            <SimpleTopGainersWidget />
          </>
        )}

        {activeTab === 'world' && <SimpleWorldIndicesWidget />}

        {activeTab === 'commodities' && <SimpleCommoditiesWidget />}

        {activeTab === 'exchange' && <SimpleExchangeRateWidget />}
      </div>

      {/* Footer Notice */}
      <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-4 border border-yellow-700/30">
        <p className="text-sm text-gray-300">
          <span className="font-semibold text-yellow-500">⚠️ Lưu ý:</span>{' '}
          Dữ liệu được lấy từ các nguồn công khai trực tuyến. Không chịu trách nhiệm về độ tin cậy của dữ liệu.
          Công cụ phục vụ mục đích thử nghiệm và tham khảo. Không khuyến khích sử dụng để ra quyết định đầu tư.
        </p>
      </div>
    </div>
  )
}
