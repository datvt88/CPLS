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

      {/* Tabs */}
      <div className="bg-[--panel] rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 border border-gray-800">
        <div className="overflow-x-auto -mx-2.5 sm:mx-0 px-2.5 sm:px-0">
          <div className="flex gap-2 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 md:px-5 py-1.5 sm:py-2 md:py-2.5 rounded-lg font-semibold transition-all whitespace-nowrap text-xs sm:text-sm md:text-base
                  ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <tab.Icon sx={{ fontSize: { xs: 16, sm: 20, md: 24 } }} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-gray-400">
          Chọn tab để xem các chỉ số khác nhau
        </div>
      </div>

      {/* Tab Content - Lazy render only active tab */}
      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        {activeTab === 'securities' && (
          <TopStocksWidget isActive={true} />
        )}

        {activeTab === 'world' && (
          <SimpleWorldIndicesWidget isActive={true} />
        )}

        {activeTab === 'commodities' && (
          <SimpleCommoditiesWidget isActive={true} />
        )}

        {activeTab === 'exchange' && (
          <ExchangeRateWidget isActive={true} />
        )}
      </div>
    </div>
  )
}
