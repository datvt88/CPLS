'use client'

import { useState, useEffect } from 'react'
import { authService } from '@/services/auth.service'
import { UserDevice } from '@/services/device.service'

export default function ActiveDevices() {
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('')

  useEffect(() => {
    loadDevices()
  }, [])

  const loadDevices = async () => {
    try {
      const { devices: userDevices, error } = await authService.getUserDevices()

      if (error) {
        console.error('Error loading devices:', error)
        return
      }

      setDevices(userDevices || [])

      // Get current device ID
      if (typeof window !== 'undefined') {
        const deviceId = localStorage.getItem('cpls-device-id') || ''
        setCurrentDeviceId(deviceId)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveDevice = async (deviceId: string) => {
    if (deviceId === currentDeviceId) {
      alert('Không thể xóa thiết bị hiện tại. Vui lòng đăng xuất.')
      return
    }

    if (!confirm('Bạn có chắc muốn đăng xuất khỏi thiết bị này?')) {
      return
    }

    try {
      const { error } = await authService.removeUserDevice(deviceId)

      if (error) {
        alert('Có lỗi xảy ra khi xóa thiết bị')
        return
      }

      // Reload devices list
      await loadDevices()
    } catch (error) {
      console.error('Error removing device:', error)
      alert('Có lỗi xảy ra')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Vừa xong'
    if (diffInMinutes < 60) return `${diffInMinutes} phút trước`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} giờ trước`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} ngày trước`

    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (loading) {
    return (
      <div className="bg-[--panel] rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-[--fg]">Thiết bị đang đăng nhập</h3>
        <span className="text-sm text-[--muted]">
          {devices.length}/3 thiết bị
        </span>
      </div>

      <p className="text-sm text-[--muted] mb-4">
        Bạn có thể đăng nhập tối đa 3 thiết bị cùng lúc. Khi đăng nhập thiết bị thứ 4, thiết bị cũ nhất sẽ tự động bị đăng xuất.
      </p>

      {devices.length === 0 ? (
        <div className="text-center py-8 text-[--muted]">
          <p>Không có thiết bị nào đang đăng nhập</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => {
            const isCurrentDevice = device.device_id === currentDeviceId

            return (
              <div
                key={device.id}
                className={`p-4 rounded-lg border ${
                  isCurrentDevice
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-gray-800/50 border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">
                        {device.os === 'Windows' && '💻'}
                        {device.os === 'macOS' && '🖥️'}
                        {device.os === 'Linux' && '🐧'}
                        {device.os === 'Android' && '📱'}
                        {device.os === 'iOS' && '📱'}
                        {!['Windows', 'macOS', 'Linux', 'Android', 'iOS'].includes(device.os || '') && '🌐'}
                      </span>
                      <div>
                        <h4 className="text-[--fg] font-semibold">
                          {device.device_name || 'Unknown Device'}
                        </h4>
                        {isCurrentDevice && (
                          <span className="text-xs text-purple-400 font-medium">
                            • Thiết bị này
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-sm text-[--muted] space-y-1">
                      <p>
                        <span className="text-gray-500">Browser:</span> {device.browser}
                      </p>
                      <p>
                        <span className="text-gray-500">OS:</span> {device.os}
                      </p>
                      <p>
                        <span className="text-gray-500">Hoạt động:</span>{' '}
                        {formatDate(device.last_active_at)}
                      </p>
                    </div>
                  </div>

                  {!isCurrentDevice && (
                    <button
                      onClick={() => handleRemoveDevice(device.device_id)}
                      className="ml-4 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors border border-red-500/30"
                    >
                      Đăng xuất
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-400">
          💡 <strong>Lưu ý:</strong> Để bảo mật tài khoản, hãy đăng xuất khỏi các thiết bị không còn sử dụng.
        </p>
      </div>
    </div>
  )
}
