'use client'
import { useEffect, useState } from 'react'
import {
  getActiveSessions,
  revokeSession,
  revokeAllOtherSessions,
  cleanupExpiredSessions,
  type SessionInfo
} from '@/lib/session-manager'
import {
  Smartphone,
  Laptop,
  Tablet,
  MapPin,
  Clock,
  LogOut,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react'

export default function DeviceManagement() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setLoading(true)
    try {
      // Cleanup expired sessions first
      await cleanupExpiredSessions()

      // Load active sessions
      const activeSessions = await getActiveSessions()
      setSessions(activeSessions)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Bạn có chắc muốn đăng xuất khỏi thiết bị này?')) return

    setActionLoading(sessionId)
    try {
      await revokeSession(sessionId)
      await loadSessions() // Reload
    } catch (error) {
      console.error('Failed to revoke session:', error)
      alert('Không thể đăng xuất khỏi thiết bị này')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevokeAllOthers = async () => {
    if (!confirm('Bạn có chắc muốn đăng xuất khỏi tất cả thiết bị khác?')) return

    setActionLoading('all')
    try {
      await revokeAllOtherSessions()
      await loadSessions() // Reload
    } catch (error) {
      console.error('Failed to revoke other sessions:', error)
      alert('Không thể đăng xuất khỏi các thiết bị khác')
    } finally {
      setActionLoading(null)
    }
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-6 h-6" />
      case 'tablet':
        return <Tablet className="w-6 h-6" />
      default:
        return <Laptop className="w-6 h-6" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    if (diffHours < 24) return `${diffHours} giờ trước`
    if (diffDays < 7) return `${diffDays} ngày trước`

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="bg-[--card] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--card] rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-purple-500" />
            Quản lý thiết bị
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {sessions.length} thiết bị đang đăng nhập
          </p>
        </div>

        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAllOthers}
            disabled={actionLoading === 'all'}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {actionLoading === 'all' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Đang xử lý...
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                Đăng xuất thiết bị khác
              </>
            )}
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Không có phiên đăng nhập nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-lg border transition-all ${
                session.is_current
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600/50'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Device Icon */}
                <div className={`p-3 rounded-lg ${
                  session.is_current ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700/50 text-gray-400'
                }`}>
                  {getDeviceIcon(session.device_type)}
                </div>

                {/* Device Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">
                      {session.device_name}
                    </h3>
                    {session.is_current && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Thiết bị này
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      <span>IP: {session.ip_address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Hoạt động lần cuối: {formatDate(session.last_activity)}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Đăng nhập lúc: {formatDate(session.created_at)}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                {!session.is_current && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={actionLoading === session.id}
                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 disabled:bg-red-600/10 disabled:cursor-not-allowed text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {actionLoading === session.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-300">
          💡 <strong>Mẹo bảo mật:</strong> Nếu bạn thấy thiết bị không quen thuộc, hãy đăng xuất ngay lập tức và đổi mật khẩu.
        </p>
      </div>
    </div>
  )
}
