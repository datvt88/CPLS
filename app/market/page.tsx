'use client'

import { useState } from 'react'
import SecuritiesWidget from '@/components/market/SecuritiesWidget'
import TopGainersWidget from '@/components/market/TopGainersWidget'
import WorldIndicesWidget from '@/components/market/WorldIndicesWidget'
import CommoditiesWidget from '@/components/market/CommoditiesWidget'
import ExchangeRateWidget from '@/components/market/ExchangeRateWidget'

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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Thị trường
          </h1>
          <p className="text-gray-400">
            Theo dõi thị trường chứng khoán và tài chính thời gian thực
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 overflow-x-auto">
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

        {/* Live Indicator */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-gray-400">Dữ liệu được cập nhật mỗi 3 giây</span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'securities' && (
            <>
              <SecuritiesWidget />
              <TopGainersWidget />
            </>
          )}

          {activeTab === 'world' && <WorldIndicesWidget />}

          {activeTab === 'commodities' && <CommoditiesWidget />}

          {activeTab === 'exchange' && <ExchangeRateWidget />}
        </div>

        {/* Footer Notice */}
        <div className="mt-8 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-4 border border-yellow-700/30">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-yellow-500">⚠️ Lưu ý:</span>{' '}
            Dữ liệu được lấy từ các nguồn công khai trực tuyến. Không chịu trách nhiệm về độ tin cậy của dữ liệu.
            Công cụ phục vụ mục đích thử nghiệm và tham khảo. Không khuyến khích sử dụng để ra quyết định đầu tư.
          </p>
        </div>
      </div>
    </div>
  )
}
