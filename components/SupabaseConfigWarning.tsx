'use client'

import { useEffect, useState } from 'react'

export default function SupabaseConfigWarning() {
  const [show, setShow] = useState(false)
  const [healthData, setHealthData] = useState<any>(null)

  useEffect(() => {
    // Kiểm tra biến môi trường thực tế
    const hasConfig =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Nếu không đủ config → báo lỗi
    if (!hasConfig) {
      setShow(true)

      fetch('/api/health')
        .then(res => res.json())
        .then(data => setHealthData(data))
        .catch(() => {})
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-start gap-3">

        <div className="flex-1">
          <h3 className="font-bold text-sm mb-1">
            ⚠️ Supabase chưa được cấu hình
          </h3>

          <p className="text-xs mb-2 opacity-90">
            Ứng dụng không thể kết nối với Supabase. Các chức năng như đăng nhập và lưu tín hiệu sẽ không hoạt động.
          </p>

          {healthData?.troubleshooting && (
            <div className="text-xs space-y-1 opacity-90">
              <p className="font-semibold">Cách khắc phục:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                {healthData.troubleshooting.actions.map((action: string, i: number) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <a
              href="/api/health"
              target="_blank"
              className="text-xs underline"
            >
              Xem chi tiết →
            </a>

            <button
              onClick={() => setShow(false)}
              className="text-xs underline"
            >
              Đóng
            </button>
          </div>

        </div>

      </div>
    </div>
  )
}
