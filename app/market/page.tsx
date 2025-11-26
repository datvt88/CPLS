'use client'

import { useState } from 'react'
import TopStocksWidget from '@/components/market/TopStocksWidget'
import SimpleWorldIndicesWidget from '@/components/market/SimpleWorldIndicesWidget'
import SimpleCommoditiesWidget from '@/components/market/SimpleCommoditiesWidget'
import ExchangeRateWidget from '@/components/market/ExchangeRateWidget'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import LanguageIcon from '@mui/icons-material/Language'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange'
import PublicIcon from '@mui/icons-material/Public'

type TabType = 'securities' | 'world' | 'commodities' | 'exchange'

const tabs: { id: TabType; label: string; Icon: any }[] = [
  { id: 'securities', label: 'Chứng khoán', Icon: ShowChartIcon },
  { id: 'world', label: 'Thế giới', Icon: LanguageIcon },
  { id: 'commodities', label: 'Hàng hóa', Icon: LocalGasStationIcon },
  { id: 'exchange', label: 'Tỷ giá', Icon: CurrencyExchangeIcon },
]

export default function MarketPage() {
  const [activeTab, setActiveTab] = useState<TabType>('securities')

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1.5 sm:mb-2 flex items-center gap-2">
          <PublicIcon sx={{ fontSize: { xs: 24, sm: 32, md: 40 } }} />
          Thị trường
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-[--muted]">
          Theo dõi thị trường chứng khoán và tài chính
        </p>
      </div>

      {/* Tabs - Vertical Layout */}
      <div className="bg-[--panel] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-gray-800">
        <div className="flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all text-sm sm:text-base
                ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white border-l-4 border-purple-500 shadow-lg'
                    : 'bg-gray-800/30 text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 border-l-4 border-transparent'
                }
              `}
            >
              <tab.Icon sx={{ fontSize: 24 }} />
              <span className="flex-1 text-left">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
              )}
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500 text-center">
          Chọn danh mục để xem chi tiết
        </div>
      </div>

      {/* Tab Content - Keep all mounted, toggle visibility with CSS */}
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <div className={activeTab === 'securities' ? 'block' : 'hidden'}>
          <TopStocksWidget isActive={activeTab === 'securities'} />
        </div>

        <div className={activeTab === 'world' ? 'block' : 'hidden'}>
          <SimpleWorldIndicesWidget isActive={activeTab === 'world'} />
        </div>

        <div className={activeTab === 'commodities' ? 'block' : 'hidden'}>
          <SimpleCommoditiesWidget isActive={activeTab === 'commodities'} />
        </div>

        <div className={activeTab === 'exchange' ? 'block' : 'hidden'}>
          <ExchangeRateWidget isActive={activeTab === 'exchange'} />
        </div>
      </div>
    </div>
  )
}
