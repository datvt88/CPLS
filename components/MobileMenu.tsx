'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'
import { NAVIGATION_ITEMS } from '@/lib/navigation'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Lock body scroll when menu is open
  useBodyScrollLock(isOpen)

  // Trap focus within menu when open
  useFocusTrap(menuRef, isOpen)

  // Memoize menu items to prevent unnecessary re-renders
  const menuItems = useMemo(() => {
    // Ensure we have menu items, fallback to empty array
    const items = NAVIGATION_ITEMS || []
    console.log('📱 MobileMenu - Menu items loaded:', items.length, 'items')
    return items
  }, [])

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Handle ESC key to close menu
  useEffect(() => {
    // Only run in browser
    if (typeof document === 'undefined') return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Check if route is active
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/' || pathname === '/dashboard'
    }
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-800 transition-colors relative z-50 md:hidden focus:outline-none focus:ring-2 focus:ring-purple-500"
        aria-label={isOpen ? 'Đóng menu' : 'Mở menu'}
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
      >
        <div className="w-6 h-5 flex flex-col justify-between">
          <span
            className={`block h-0.5 w-6 bg-white transition-all duration-300 ${
              isOpen ? 'rotate-45 translate-y-2' : ''
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-white transition-all duration-300 ${
              isOpen ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-white transition-all duration-300 ${
              isOpen ? '-rotate-45 -translate-y-2' : ''
            }`}
          />
        </div>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Menu Panel */}
      <div
        ref={menuRef}
        id="mobile-menu"
        className={`fixed top-0 right-0 h-full w-[280px] max-w-[80vw] sm:w-80 bg-[--panel] border-l border-gray-800 z-40 transform transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="navigation"
        aria-label="Main navigation"
        aria-hidden={!isOpen}
      >
        <div className="p-4 sm:p-6 flex flex-col h-full">
          {/* Header */}
          <div className="mb-4 sm:mb-6 flex items-center gap-3 pb-4 border-b border-gray-800">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-sm">
              CPLS
            </div>
            <div>
              <div className="text-white font-semibold">CPLS</div>
              <div className="text-xs sm:text-sm text-[--muted]">Master Trader</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 flex-1 overflow-y-auto">
            {menuItems.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>Không có danh mục</p>
                <p className="text-xs mt-2">Debug: Check NAVIGATION_ITEMS import</p>
              </div>
            ) : (
              menuItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center py-3 px-3 rounded-lg transition-all duration-200 ${
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
                        <div className="text-xs text-gray-400 mt-0.5 hidden sm:block">
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

          {/* Actions */}
          <div className="pt-4 border-t border-gray-800 space-y-3">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-full py-3 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[--panel]"
            >
              Đăng nhập
            </Link>
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-[--muted]">Giao diện</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
