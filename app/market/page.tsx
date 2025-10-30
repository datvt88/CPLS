'use client'
import { useState } from 'react'
import { MarketTab } from '@/types'
import SecuritiesWidget from '@/components/market/SecuritiesWidget'
import TopGainersWidget from '@/components/market/TopGainersWidget'
import WorldIndicesWidget from '@/components/market/WorldIndicesWidget'
import CommoditiesWidget from '@/components/market/CommoditiesWidget'
import ExchangeRateWidget from '@/components/market/ExchangeRateWidget'

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<MarketTab>('securities')

  const tabs = [
    { id: 'securities' as MarketTab, label: 'Chứng khoán', icon: '📈' },
    { id: 'world' as MarketTab, label: 'Thế giới', icon: '🌏' },
    { id: 'commodities' as MarketTab, label: 'Hàng hóa', icon: '🛢️' },
    { id: 'exchange' as MarketTab, label: 'Tỷ giá', icon: '💱' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-panel rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Thị trường</h1>
            <p className="text-muted mt-1">
              Dữ liệu thời gian thực - Tự động làm mới mỗi 5 giây
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-panel rounded-xl border border-gray-800 overflow-hidden">
        <div className="flex border-b border-gray-800 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={'flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ' +
                (activeTab === tab.id
                  ? 'bg-purple-600 text-white border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800')}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'securities' && (
            <div className="space-y-6">
              <SecuritiesWidget />
              <TopGainersWidget />
            </div>
          )}

          {activeTab === 'world' && <WorldIndicesWidget />}

          {activeTab === 'commodities' && <CommoditiesWidget />}

          {activeTab === 'exchange' && <ExchangeRateWidget />}
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>ℹ️</span>
          <span>
            Dữ liệu được cung cấp bởi VNDirect API - Chỉ mang tính chất tham khảo
          </span>
        </div>
      </div>
    </div>
  )
}
