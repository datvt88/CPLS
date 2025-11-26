'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PublicIcon from '@mui/icons-material/Public'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import BoltIcon from '@mui/icons-material/Bolt'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import PersonIcon from '@mui/icons-material/Person'

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = useUnreadMessages()

  const menuItems = [
    { href: '/dashboard', label: 'Tổng quan', Icon: DashboardIcon },
    { href: '/market', label: 'Thị trường', Icon: PublicIcon },
    { href: '/stocks', label: 'Cổ phiếu', Icon: TrendingUpIcon },
    { href: '/signals', label: 'Tín hiệu', Icon: BoltIcon },
    { href: '/chat', label: 'Kiếm tiền đi chợ', Icon: ChatBubbleIcon },
    { href: '/profile', label: 'Cá nhân', Icon: PersonIcon },
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
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-[#0f1720] backdrop-blur-md border-l border-gray-800 rounded-l-2xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: 'rgba(15, 23, 32, 0.3)' }}
      >
        <div className="p-6 flex flex-col h-full">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3 pb-4 border-b border-gray-800">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold">
              CPLS
            </div>
            <div>
              <div className="text-white font-semibold">CPLS</div>
              <div className="text-sm text-[--muted]">Master Trader</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-2 flex-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center py-3 px-3 rounded hover:bg-gray-800 text-gray-200 transition-colors relative"
              >
                <item.Icon sx={{ fontSize: 24 }} />
                <span className="ml-3">{item.label}</span>
                {item.href === '/chat' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-800 space-y-3">
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-full py-3 px-4 rounded bg-purple-600 hover:bg-purple-700 text-white transition-colors font-medium"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
