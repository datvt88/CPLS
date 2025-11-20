'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { NAVIGATION_ITEMS } from '@/lib/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  // Memoize navigation items
  const items = useMemo(() => {
    // Ensure we have menu items, fallback to empty array
    return NAVIGATION_ITEMS || []
  }, [])

  // Check if route is active
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="w-72 hidden md:block bg-[--panel] border-r border-gray-800 min-h-screen p-6">
      {/* Header */}
      <Link href="/dashboard" className="mb-6 flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-sm">
          CPLS
        </div>
        <div>
          <div className="text-white font-semibold">CPLS</div>
          <div className="text-sm text-[--muted]">Master Trader</div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="space-y-1" role="navigation" aria-label="Main navigation">
        {items.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p>Không có danh mục</p>
          </div>
        ) : (
          items.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center py-3 px-3 rounded-lg transition-all duration-200 group ${
                  active
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                    : 'text-gray-200 hover:bg-gray-800 hover:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div className="ml-3 flex-1">
                  <div className="font-medium">{item.label}</div>
                  {item.description && !active && (
                    <div className="text-xs text-gray-400 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.description}
                    </div>
                  )}
                </div>
                {active && (
                  <svg
                    className="w-5 h-5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </Link>
            )
          })
        )}
      </nav>
    </aside>
  )
}
