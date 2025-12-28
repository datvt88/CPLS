'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { getSignals, getStrategies } from '@/services/signalApi.service'
import type { Signal, PaginatedResponse, SignalFilters, StrategyInfo } from '@/types/signal'
import ListAltIcon from '@mui/icons-material/ListAlt'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FilterListIcon from '@mui/icons-material/FilterList'

// Format number
const formatNumber = (num: number | undefined): string => {
  if (num === undefined || num === null) return '-'
  return num.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

// Format percentage
const formatPercent = (num: number | undefined): string => {
  if (num === undefined || num === null) return '-'
  return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`
}

// Format date
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '-'
  try {
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return '-'
  }
}

// Desktop Row
const DesktopRow = memo(({ signal, onClick }: { signal: Signal; onClick: () => void }) => (
  <tr
    onClick={onClick}
    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer group"
  >
    <td className="py-3 px-4">
      <span className="font-bold text-white text-base group-hover:text-blue-400 transition-colors">
        {signal.stock_code}
      </span>
    </td>
    <td className="py-3 px-4">
      <span className={`
        px-2 py-1 rounded text-xs font-medium
        ${signal.signal_type === 'BUY' ? 'bg-green-500/20 text-green-400'
          : signal.signal_type === 'SELL' ? 'bg-red-500/20 text-red-400'
          : 'bg-gray-500/20 text-gray-400'}
      `}>
        {signal.signal_type === 'BUY' ? 'MUA' : signal.signal_type === 'SELL' ? 'BÁN' : 'GIỮ'}
      </span>
    </td>
    <td className="py-3 px-4 text-gray-400 text-sm">{signal.strategy}</td>
    <td className="py-3 px-4 text-right text-white">{formatNumber(signal.entry_price)}</td>
    <td className="py-3 px-4 text-right text-green-400">{formatNumber(signal.target_price)}</td>
    <td className="py-3 px-4 text-right text-red-400">{formatNumber(signal.stop_loss)}</td>
    <td className="py-3 px-4 text-right">
      <span className={`font-semibold ${signal.potential_gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {formatPercent(signal.potential_gain)}
      </span>
    </td>
    <td className="py-3 px-4 text-right text-purple-400">
      {(signal.confidence * 100).toFixed(0)}%
    </td>
    <td className="py-3 px-4">
      <span className={`
        text-[10px] px-1.5 py-0.5 rounded border font-medium
        ${signal.signal_strength === 'strong' ? 'bg-green-500/20 text-green-400 border-green-500/30'
          : signal.signal_strength === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
      `}>
        {signal.signal_strength === 'strong' ? 'Mạnh' : signal.signal_strength === 'medium' ? 'TB' : 'Yếu'}
      </span>
    </td>
    <td className="py-3 px-4 text-right text-gray-500 text-sm">{formatDate(signal.created_at)}</td>
  </tr>
))
DesktopRow.displayName = 'DesktopRow'

// Mobile Card
const MobileCard = memo(({ signal, onClick }: { signal: Signal; onClick: () => void }) => (
  <div
    onClick={onClick}
    className="border-b border-gray-800 p-3 cursor-pointer bg-[#111] last:border-0 active:bg-gray-800/50"
  >
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center gap-2">
        <span className="font-bold text-white text-lg">{signal.stock_code}</span>
        <span className={`
          text-[10px] px-1.5 py-0.5 rounded font-medium
          ${signal.signal_type === 'BUY' ? 'bg-green-900/30 text-green-400'
            : signal.signal_type === 'SELL' ? 'bg-red-900/30 text-red-400'
            : 'bg-gray-900/30 text-gray-400'}
        `}>
          {signal.signal_type === 'BUY' ? 'MUA' : signal.signal_type === 'SELL' ? 'BÁN' : 'GIỮ'}
        </span>
        <span className={`
          text-[10px] px-1.5 py-0.5 rounded border font-medium
          ${signal.signal_strength === 'strong' ? 'bg-green-500/20 text-green-400 border-green-500/30'
            : signal.signal_strength === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}
        `}>
          {signal.signal_strength === 'strong' ? 'Mạnh' : signal.signal_strength === 'medium' ? 'TB' : 'Yếu'}
        </span>
      </div>
      <span className="text-xs text-gray-500">{formatDate(signal.created_at)}</span>
    </div>

    <div className="grid grid-cols-3 gap-2 text-sm mb-2">
      <div>
        <span className="text-gray-500 text-xs">Giá vào</span>
        <div className="text-white font-medium">{formatNumber(signal.entry_price)}</div>
      </div>
      <div>
        <span className="text-gray-500 text-xs">Mục tiêu</span>
        <div className="text-green-400 font-medium">{formatNumber(signal.target_price)}</div>
      </div>
      <div>
        <span className="text-gray-500 text-xs">Cắt lỗ</span>
        <div className="text-red-400 font-medium">{formatNumber(signal.stop_loss)}</div>
      </div>
    </div>

    <div className="flex justify-between items-center pt-2 border-t border-gray-800">
      <span className="text-xs text-gray-500">{signal.strategy}</span>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${signal.potential_gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatPercent(signal.potential_gain)}
        </span>
        <span className="text-xs text-purple-400">{(signal.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  </div>
))
MobileCard.displayName = 'MobileCard'

// Skeleton Loader
const SkeletonLoader = () => (
  <>
    <div className="sm:hidden space-y-0 divide-y divide-gray-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-3 animate-pulse">
          <div className="flex justify-between mb-2">
            <div className="h-6 w-24 bg-gray-800 rounded" />
            <div className="h-5 w-16 bg-gray-800 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="h-10 bg-gray-800 rounded" />
            <div className="h-10 bg-gray-800 rounded" />
            <div className="h-10 bg-gray-800 rounded" />
          </div>
        </div>
      ))}
    </div>
    <table className="hidden sm:table w-full">
      <tbody>
        {Array.from({ length: 8 }).map((_, i) => (
          <tr key={i} className="border-b border-gray-800 animate-pulse">
            {Array.from({ length: 10 }).map((_, j) => (
              <td key={j} className="py-4 px-4">
                <div className="h-5 bg-gray-800 rounded" style={{ width: `${40 + Math.random() * 40}px` }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </>
)

function SignalsListWidget() {
  const router = useRouter()
  const [signals, setSignals] = useState<PaginatedResponse<Signal>>({
    data: [],
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  })
  const [strategies, setStrategies] = useState<StrategyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [filters, setFilters] = useState<SignalFilters>({
    page: 1,
    limit: 20,
  })

  const fetchSignals = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getSignals(filters)
      setSignals(data)
    } catch (err: any) {
      console.error('Error fetching signals:', err)
      setError('Không thể tải danh sách tín hiệu')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const fetchStrategies = useCallback(async () => {
    try {
      const data = await getStrategies()
      setStrategies(data)
    } catch (err) {
      console.error('Error fetching strategies:', err)
    }
  }, [])

  useEffect(() => {
    fetchSignals()
  }, [fetchSignals])

  useEffect(() => {
    fetchStrategies()
  }, [fetchStrategies])

  const handleStockClick = (stockCode: string) => {
    router.push(`/stocks?symbol=${stockCode}`)
  }

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }))
  }

  const handleFilterChange = (key: keyof SignalFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }))
  }

  return (
    <div className="bg-[--panel] sm:rounded-xl sm:p-6 sm:border border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-3 sm:px-0">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <ListAltIcon className="text-blue-400" sx={{ fontSize: 24 }} />
            Danh sách tín hiệu
          </h3>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            {signals.total > 0 ? `${signals.total.toLocaleString()} tín hiệu` : 'Đang tải...'}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm transition-all
            ${showFilters
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-transparent'}
          `}
        >
          <FilterListIcon sx={{ fontSize: 18 }} />
          <span className="hidden sm:inline">Bộ lọc</span>
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-800/30 rounded-lg mx-3 sm:mx-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Signal Type Filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Loại tín hiệu</label>
              <select
                value={filters.signal_type || ''}
                onChange={(e) => handleFilterChange('signal_type', e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="BUY">MUA</option>
                <option value="SELL">BÁN</option>
                <option value="HOLD">GIỮ</option>
              </select>
            </div>

            {/* Strategy Filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Chiến lược</label>
              <select
                value={filters.strategy || ''}
                onChange={(e) => handleFilterChange('strategy', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Tất cả</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Signal Strength Filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Độ mạnh</label>
              <select
                value={filters.signal_strength || ''}
                onChange={(e) => handleFilterChange('signal_strength', e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="strong">Mạnh</option>
                <option value="medium">Trung bình</option>
                <option value="weak">Yếu</option>
              </select>
            </div>

            {/* Stock Code Filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Mã CP</label>
              <input
                type="text"
                value={filters.stock_code || ''}
                onChange={(e) => handleFilterChange('stock_code', e.target.value.toUpperCase())}
                placeholder="VD: VNM"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/10 border border-red-500/20 rounded-lg p-4 text-center mx-3 sm:mx-0">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={fetchSignals}
            className="mt-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="overflow-hidden rounded-lg sm:border border-gray-800 bg-transparent sm:bg-[#111]">
          <SkeletonLoader />
        </div>
      )}

      {/* Signals List */}
      {!loading && !error && (
        <>
          {signals.data.length > 0 ? (
            <div className="overflow-hidden rounded-lg sm:border border-gray-800 bg-transparent sm:bg-[#111]">
              {/* Mobile View */}
              <div className="block sm:hidden divide-y divide-gray-800 border-t border-b border-gray-800">
                {signals.data.map((signal) => (
                  <MobileCard
                    key={signal.id}
                    signal={signal}
                    onClick={() => handleStockClick(signal.stock_code)}
                  />
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800/50 text-gray-400 uppercase text-xs">
                    <tr>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Mã CP</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Tín hiệu</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Chiến lược</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Giá vào</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Mục tiêu</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Cắt lỗ</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Tiềm năng</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Tin cậy</th>
                      <th className="py-3 px-4 font-semibold whitespace-nowrap">Độ mạnh</th>
                      <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Ngày</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {signals.data.map((signal) => (
                      <DesktopRow
                        key={signal.id}
                        signal={signal}
                        onClick={() => handleStockClick(signal.stock_code)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800/30 rounded-lg p-6 text-center mx-3 sm:mx-0">
              <p className="text-gray-400 text-sm">Không có tín hiệu nào</p>
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {!loading && !error && signals.total_pages > 1 && (
        <div className="flex items-center justify-between mt-4 px-3 sm:px-0">
          <div className="text-gray-400 text-sm">
            Trang {signals.page} / {signals.total_pages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(signals.page - 1)}
              disabled={signals.page <= 1}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${signals.page <= 1
                  ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
              `}
            >
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
              <span className="hidden sm:inline">Trước</span>
            </button>
            <button
              onClick={() => handlePageChange(signals.page + 1)}
              disabled={signals.page >= signals.total_pages}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${signals.page >= signals.total_pages
                  ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}
              `}
            >
              <span className="hidden sm:inline">Sau</span>
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(SignalsListWidget)
