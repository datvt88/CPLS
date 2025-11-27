'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PublicIcon from '@mui/icons-material/Public'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import BoltIcon from '@mui/icons-material/Bolt'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import PersonIcon from '@mui/icons-material/Person'
import CloseIcon from '@mui/icons-material/Close'

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const unreadCount = useUnreadMessages()
  const pathname = usePathname()

  // Đóng menu khi route thay đổi
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Ngăn scroll khi menu mở
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

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
      {/* Hamburger Button - Minimal Design */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative z-50 p-2.5 rounded-xl bg-white/5 hover:bg-white/10
                   backdrop-blur-sm border border-white/10 transition-all duration-200
                   active:scale-95"
        aria-label="Mở menu"
        aria-expanded={isOpen}
      >
        <div className="w-5 h-4 flex flex-col justify-between">
          <span className="block h-[2px] w-5 bg-white/90 rounded-full" />
          <span className="block h-[2px] w-3.5 bg-white/90 rounded-full" />
          <span className="block h-[2px] w-5 bg-white/90 rounded-full" />
        </div>
      </button>

      {/* Overlay với blur effect */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          isOpen
            ? 'bg-black/60 backdrop-blur-sm opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Menu Panel - Slide từ phải */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
        className={`fixed top-0 right-0 h-full w-[85vw] max-w-[320px] z-50
                    bg-gradient-to-b from-[#0a0f16] to-[#0d1420]
                    border-l border-white/[0.08]
                    shadow-[-20px_0_60px_rgba(0,0,0,0.5)]
                    transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Glass effect top */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative h-full flex flex-col p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 group"
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden
                            ring-2 ring-white/10 group-hover:ring-purple-500/50
                            transition-all duration-300">
                <Image
                  src="/logo.png"
                  alt="CPLS Logo"
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
              <div>
                <div className="text-white font-semibold text-lg tracking-tight">CPLS</div>
                <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">
                  Trading Platform
                </div>
              </div>
            </Link>

            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10
                        border border-white/10 transition-all duration-200
                        active:scale-95"
              aria-label="Đóng menu"
            >
              <CloseIcon sx={{ fontSize: 20 }} className="text-white/70" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 -mx-2">
            <div className="space-y-1">
              {menuItems.map((item, index) => {
                const isActive = pathname === item.href
                const hasUnread = item.href === '/chat' && unreadCount > 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl
                              transition-all duration-200 relative overflow-hidden
                              ${isActive
                                ? 'bg-gradient-to-r from-purple-500/20 to-transparent text-white'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                              }`}
                    style={{
                      animationDelay: `${index * 50}ms`
                    }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8
                                    bg-gradient-to-b from-purple-400 to-purple-600 rounded-r-full" />
                    )}

                    <div className={`p-2 rounded-lg transition-colors duration-200
                                  ${isActive
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-white/5 text-white/50 group-hover:bg-white/10 group-hover:text-white/70'
                                  }`}>
                      <item.Icon sx={{ fontSize: 20 }} />
                    </div>

                    <span className="font-medium text-[15px]">{item.label}</span>

                    {hasUnread && (
                      <span className="ml-auto flex items-center justify-center
                                     min-w-[22px] h-[22px] px-1.5
                                     bg-gradient-to-r from-red-500 to-rose-500
                                     text-white text-[11px] font-bold rounded-full
                                     shadow-lg shadow-red-500/30
                                     animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="pt-6 mt-auto border-t border-white/[0.06] space-y-3">
            {/* User greeting - có thể thay bằng user info thật */}
            <div className="flex items-center gap-3 px-2 py-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-500/30
                            flex items-center justify-center border border-white/10">
                <PersonIcon sx={{ fontSize: 18 }} className="text-white/60" />
              </div>
              <div className="flex-1">
                <div className="text-white/40 text-xs">Xin chào!</div>
                <div className="text-white/80 text-sm font-medium">Khách</div>
              </div>
            </div>

            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-full py-3.5 px-4
                        rounded-xl font-semibold text-[15px]
                        bg-gradient-to-r from-purple-600 to-indigo-600
                        hover:from-purple-500 hover:to-indigo-500
                        text-white shadow-lg shadow-purple-500/25
                        transition-all duration-200 active:scale-[0.98]"
            >
              Đăng nhập
            </Link>

            <Link
              href="/register"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center w-full py-3.5 px-4
                        rounded-xl font-medium text-[15px]
                        bg-white/5 hover:bg-white/10
                        text-white/80 hover:text-white
                        border border-white/10 hover:border-white/20
                        transition-all duration-200 active:scale-[0.98]"
            >
              Tạo tài khoản
            </Link>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 right-0 h-40
                      bg-gradient-to-t from-purple-500/5 to-transparent
                      pointer-events-none" />
      </div>
    </>
  )
}
