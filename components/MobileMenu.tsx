'use client'
import { useState } from 'react'
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = useUnreadMessages()

  const menuItems = [
    { href: '/dashboard', label: 'Tổng quan', icon: '📊' },
    { href: '/market', label: 'Thị trường', icon: '🌐' },
    { href: '/stocks', label: 'Cổ phiếu', icon: '💹' },
    { href: '/signals', label: 'Tín hiệu', icon: '⚡' },
    { href: '/chat', label: 'Room Chat', icon: '💬' },
    { href: '/profile', label: 'Cá nhân', icon: '👤' },
  ]

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-gray-800 transition-colors relative z-50"
        aria-label="Toggle menu"
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
          className="fixed inset-0 bg-black bg-opacity-75 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-gray-950 border-l border-gray-700 z-40 transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 sm:p-6 flex flex-col h-full bg-gradient-to-b from-gray-950 to-black">
          {/* Header */}
          <div className="mb-4 sm:mb-6 flex items-center gap-3 pb-3 sm:pb-4 border-b border-gray-700">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-sm sm:text-base shadow-lg">
              CPLS
            </div>
            <div>
              <div className="text-white font-bold text-base">CPLS</div>
              <div className="text-xs text-gray-400">Master Trader</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 flex-1 overflow-y-auto">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center py-2.5 px-3 rounded-lg hover:bg-gray-800/80 active:bg-gray-700 text-gray-100 transition-all duration-200 relative group"
              >
                <span className="text-lg sm:text-xl">{item.icon}</span>
                <span className="ml-3 font-medium group-hover:text-white">{item.label}</span>
                {item.href === '/chat' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-md">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="pt-3 sm:pt-4 border-t border-gray-700 space-y-3">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-full py-2.5 sm:py-3 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white transition-all duration-200 font-semibold shadow-lg"
            >
              Đăng nhập
            </Link>
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-gray-400 font-medium">Giao diện</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
