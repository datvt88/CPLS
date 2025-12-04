'use client'

import { useEffect, useState } from 'react'

/**
 * Component to display warning when Supabase is not configured properly
 * Compatible with new supabaseClient (no supabaseConfig export)
 */
export default function SupabaseConfigWarning() {
  const [show, setShow] = useState(false)
  const [healthData, setHealthData] = useState<any>(null)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const isConfigured =
      typeof url === 'string' &&
      url.startsWith('https://') &&
      typeof key === 'string' &&
      key.startsWith('eyJ')

    if (!isConfigured) {
      setShow(true)

      fetch('/api/health')
        .then(res => res.json())
        .then(data => setHealthData(data))
        .catch(err => console.error('Failed to fetch health check:', err))
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="font-bold text-sm mb-1">
            ⚠️ Supabase chưa được cấu hình
          </h3>

          <p className="text-xs mb-2 opacity-90">
            Ứng dụng không thể kết nối với Supabase. Đăng nhập sẽ không hoạt động.
          </p>

          {healthData?.troubleshooting && (
            <div className="text-xs space-y-1 opacity-90">
              <p className="font-semibold">Cách khắc phục:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                {healthData.troubleshooting.actions.map(
                  (action: string, i: number) => (
                    <li key={i}>{action}</li>
                  )
                )}
              </ul>
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline hover:no-underline"
            >
              Xem chi tiết →
            </a>

            <button
              onClick={() => setShow(false)}
              className="text-xs underline hover:no-underline"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
