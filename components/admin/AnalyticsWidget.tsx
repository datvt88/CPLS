'use client'

import { useState, useEffect } from 'react'

interface AnalyticsConfig {
  clarityEnabled: boolean
  clarityId: string
  googleAnalyticsEnabled: boolean
  googleAnalyticsId: string
}

export default function AnalyticsWidget() {
  const [config, setConfig] = useState<AnalyticsConfig>({
    clarityEnabled: true, // Clarity đã được tích hợp sẵn
    clarityId: 'udywqzdpit',
    googleAnalyticsEnabled: false,
    googleAnalyticsId: '',
  })
  const [editMode, setEditMode] = useState(false)
  const [tempConfig, setTempConfig] = useState<AnalyticsConfig>(config)

  useEffect(() => {
    // Load config from localStorage
    const savedConfig = localStorage.getItem('analytics-config')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig(parsed)
        setTempConfig(parsed)
      } catch (e) {
        console.error('Error parsing analytics config:', e)
      }
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('analytics-config', JSON.stringify(tempConfig))
    setConfig(tempConfig)
    setEditMode(false)

    // Reload page to apply changes
    if (confirm('Cài đặt đã được lưu. Tải lại trang để áp dụng thay đổi?')) {
      window.location.reload()
    }
  }

  const handleCancel = () => {
    setTempConfig(config)
    setEditMode(false)
  }

  return (
    <div className="bg-[#1a1a2e] border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">
            📈 Analytics Integration
          </h2>
          <p className="text-gray-400 text-sm">
            Tích hợp Microsoft Clarity và Google Analytics để theo dõi người dùng
          </p>
        </div>
        {!editMode ? (
          <button
            onClick={() => setEditMode(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            ✏️ Chỉnh sửa
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              ❌ Hủy
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              ✅ Lưu
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Microsoft Clarity */}
        <div className="border border-gray-700 rounded-lg p-5 bg-[#0f0f1e]/50">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center text-2xl">
                🔍
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Microsoft Clarity</h3>
                <p className="text-gray-400 text-sm">
                  Heat maps, session recordings, và insights
                </p>
              </div>
            </div>
            {editMode ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempConfig.clarityEnabled}
                  onChange={(e) => setTempConfig({ ...tempConfig, clarityEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            ) : (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                config.clarityEnabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {config.clarityEnabled ? '✓ Đang hoạt động' : '✗ Tắt'}
              </span>
            )}
          </div>

          {editMode ? (
            <div>
              <label className="block text-gray-400 text-sm mb-2">Clarity Project ID</label>
              <input
                type="text"
                value={tempConfig.clarityId}
                onChange={(e) => setTempConfig({ ...tempConfig, clarityId: e.target.value })}
                placeholder="udywqzdpit"
                className="w-full bg-[#0a0a1a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-gray-500 text-xs mt-2">
                Tìm trong mã Clarity: <code className="text-blue-400">clarity("script", "YOUR_ID")</code>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-gray-400 text-sm">Project ID:</span>
              <code className="bg-[#0a0a1a] px-3 py-1 rounded text-blue-400 text-sm font-mono">
                {config.clarityId || 'Chưa cấu hình'}
              </code>
            </div>
          )}

          {config.clarityEnabled && config.clarityId && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <a
                href={`https://clarity.microsoft.com/projects/view/${config.clarityId}/dashboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                🔗 Mở Clarity Dashboard
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Google Analytics */}
        <div className="border border-gray-700 rounded-lg p-5 bg-[#0f0f1e]/50">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center text-2xl">
                📊
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Google Analytics</h3>
                <p className="text-gray-400 text-sm">
                  Traffic analytics và user behavior tracking
                </p>
              </div>
            </div>
            {editMode ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={tempConfig.googleAnalyticsEnabled}
                  onChange={(e) => setTempConfig({ ...tempConfig, googleAnalyticsEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            ) : (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                config.googleAnalyticsEnabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {config.googleAnalyticsEnabled ? '✓ Đang hoạt động' : '✗ Tắt'}
              </span>
            )}
          </div>

          {editMode ? (
            <div>
              <label className="block text-gray-400 text-sm mb-2">Google Analytics Measurement ID</label>
              <input
                type="text"
                value={tempConfig.googleAnalyticsId}
                onChange={(e) => setTempConfig({ ...tempConfig, googleAnalyticsId: e.target.value })}
                placeholder="G-XXXXXXXXXX hoặc UA-XXXXXXXXX-X"
                className="w-full bg-[#0a0a1a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-gray-500 text-xs mt-2">
                Tìm trong Google Analytics: Admin → Data Streams → Measurement ID
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-gray-400 text-sm">Measurement ID:</span>
              <code className="bg-[#0a0a1a] px-3 py-1 rounded text-orange-400 text-sm font-mono">
                {config.googleAnalyticsId || 'Chưa cấu hình'}
              </code>
            </div>
          )}

          {config.googleAnalyticsEnabled && config.googleAnalyticsId && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <a
                href="https://analytics.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm transition-colors"
              >
                🔗 Mở Google Analytics
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <h4 className="text-white font-semibold mb-1">Lưu ý</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• Các script analytics được tự động thêm vào tất cả các trang</li>
                <li>• Clarity tracking sessions, clicks, scrolls và heatmaps</li>
                <li>• Google Analytics tracking pageviews, events và conversions</li>
                <li>• Dữ liệu sẽ hiển thị trong dashboard sau vài phút</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
