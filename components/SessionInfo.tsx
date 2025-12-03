'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getDeviceFingerprint } from '@/lib/session-manager'

interface SessionDetails {
  userEmail: string
  deviceFingerprint: string
  jwtExpiresAt: string
  timeUntilExpiry: string
  lastActivity: string
  daysSinceActivity: string
  willLogoutAt: string
  sessionDuration: string
}

/**
 * SessionInfo Component
 * Displays current session information for debugging and user awareness
 */
export default function SessionInfo() {
  const [sessionInfo, setSessionInfo] = useState<SessionDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    loadSessionInfo()
  }, [])

  const loadSessionInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setSessionInfo(null)
        setIsLoading(false)
        return
      }

      // Get session from database
      const fingerprint = await getDeviceFingerprint()
      const { data: dbSession } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('fingerprint', fingerprint)
        .eq('is_active', true)
        .maybeSingle()

      const expiresAt = session.expires_at || 0
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = expiresAt - now

      const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000 // 30 days

      const info: SessionDetails = {
        userEmail: session.user.email || 'Unknown',
        deviceFingerprint: fingerprint.slice(0, 12) + '...',
        jwtExpiresAt: new Date(expiresAt * 1000).toLocaleString('vi-VN'),
        timeUntilExpiry: `${Math.floor(timeUntilExpiry / 3600)}h ${Math.floor((timeUntilExpiry % 3600) / 60)}m`,
        lastActivity: dbSession ? new Date(dbSession.last_activity).toLocaleString('vi-VN') : 'N/A',
        daysSinceActivity: dbSession
          ? ((Date.now() - new Date(dbSession.last_activity).getTime()) / (24 * 60 * 60 * 1000)).toFixed(2)
          : 'N/A',
        willLogoutAt: dbSession
          ? new Date(new Date(dbSession.last_activity).getTime() + INACTIVITY_TIMEOUT).toLocaleString('vi-VN')
          : 'N/A',
        sessionDuration: '30 ngày'
      }

      setSessionInfo(info)
    } catch (error) {
      console.error('Error loading session info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return null
  }

  if (!sessionInfo) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-all mb-2 flex items-center justify-center"
        title="Thông tin phiên đăng nhập"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Session Info Panel */}
      {isVisible && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Phiên đăng nhập
            </h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="border-b border-gray-700 pb-2">
              <p className="text-gray-400">Email</p>
              <p className="text-white font-mono text-xs">{sessionInfo.userEmail}</p>
            </div>

            <div className="border-b border-gray-700 pb-2">
              <p className="text-gray-400">Thiết bị</p>
              <p className="text-white font-mono text-xs">{sessionInfo.deviceFingerprint}</p>
            </div>

            <div className="border-b border-gray-700 pb-2">
              <p className="text-gray-400">Thời hạn phiên</p>
              <p className="text-green-400 font-semibold">{sessionInfo.sessionDuration}</p>
            </div>

            <div className="border-b border-gray-700 pb-2">
              <p className="text-gray-400">Token hết hạn lúc</p>
              <p className="text-white text-xs">{sessionInfo.jwtExpiresAt}</p>
              <p className="text-purple-400 text-xs mt-1">Còn {sessionInfo.timeUntilExpiry}</p>
            </div>

            <div className="border-b border-gray-700 pb-2">
              <p className="text-gray-400">Hoạt động lần cuối</p>
              <p className="text-white text-xs">{sessionInfo.lastActivity}</p>
              <p className="text-gray-400 text-xs mt-1">{sessionInfo.daysSinceActivity} ngày trước</p>
            </div>

            <div>
              <p className="text-gray-400">Tự động đăng xuất sau</p>
              <p className="text-orange-400 text-xs">{sessionInfo.willLogoutAt}</p>
              <p className="text-gray-500 text-xs mt-1">Nếu không hoạt động trong 30 ngày</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={loadSessionInfo}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded text-xs transition-colors"
            >
              🔄 Làm mới thông tin
            </button>
          </div>

          <div className="mt-2 p-2 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-300">
            <p className="font-semibold mb-1">💡 Thông tin:</p>
            <ul className="space-y-1 text-xs">
              <li>• Phiên đăng nhập tự động lưu 30 ngày</li>
              <li>• Tối đa 3 thiết bị cùng lúc</li>
              <li>• Token tự động refresh trước 5 phút</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
