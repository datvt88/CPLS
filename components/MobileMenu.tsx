'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { supabase } from '@/lib/supabaseClient'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PublicIcon from '@mui/icons-material/Public'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import BoltIcon from '@mui/icons-material/Bolt'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import PersonIcon from '@mui/icons-material/Person'
import CloseIcon from '@mui/icons-material/Close'

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const unreadCount = useUnreadMessages()
  const pathname = usePathname()

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)

        // Fetch profile data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', session.user.id)
          .single()

        if (profileData) {
          setProfile(profileData)
        }
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)

        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', session.user.id)
          .single()

        if (profileData) {
          setProfile(profileData)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

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

  // Get display name
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name
    if (user?.user_metadata?.name) return user.user_metadata.name
    if (profile?.email) return profile.email.split('@')[0]
    if (user?.email) return user.email.split('@')[0]
    return 'Người dùng'
  }

  return (
    <>
      {/* Hamburger Button - Minimal Design */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative z-50 p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700
                   border border-gray-700 transition-all duration-200
                   active:scale-95"
        aria-label="Mở menu"
        aria-expanded={isOpen}
      >
        <div className="w-5 h-4 flex flex-col justify-between">
          <span className="block h-[2px] w-5 bg-white rounded-full" />
          <span className="block h-[2px] w-3.5 bg-white rounded-full" />
          <span className="block h-[2px] w-5 bg-white rounded-full" />
        </div>
      </button>

      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          isOpen
            ? 'bg-black opacity-100 pointer-events-auto'
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
        className={`fixed top-0 right-0 h-screen max-h-[100dvh] w-[75vw] max-w-[240px] z-50
                    bg-[#0f1117]
                    border-l border-gray-800
                    shadow-[-20px_0_60px_rgba(0,0,0,0.5)]
                    transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >

        <div className="relative h-full flex flex-col p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 group"
            >
              <div className="relative w-10 h-10 rounded-xl overflow-hidden
                            ring-2 ring-gray-700 group-hover:ring-purple-500
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
                <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">
                  MENU
                </div>
              </div>
            </Link>

            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700
                        border border-gray-700 transition-all duration-200
                        active:scale-95"
              aria-label="Đóng menu"
            >
              <CloseIcon sx={{ fontSize: 20 }} className="text-gray-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 -mx-2 overflow-y-auto overflow-x-hidden min-h-0">
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
                                ? 'bg-purple-900 text-white'
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
                                    ? 'bg-purple-800 text-purple-400'
                                    : 'bg-gray-800 text-gray-500 group-hover:bg-gray-700 group-hover:text-gray-300'
                                  }`}>
                      <item.Icon sx={{ fontSize: 20 }} />
                    </div>

                    <span className="font-medium text-[15px]">{item.label}</span>

                    {hasUnread && (
                      <span className="ml-auto flex items-center justify-center
                                     min-w-[22px] h-[22px] px-1.5
                                     bg-gradient-to-r from-red-500 to-rose-500
                                     text-white text-[11px] font-bold rounded-full
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
          <div className="pt-6 mt-auto border-t border-gray-800 space-y-3 flex-shrink-0">
            {user ? (
              // User is logged in - show user info only
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="w-9 h-9 rounded-full bg-purple-900
                              flex items-center justify-center border border-gray-700">
                  <PersonIcon sx={{ fontSize: 18 }} className="text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-gray-500 text-xs">Xin chào!</div>
                  <div className="text-white text-sm font-medium truncate">
                    {getDisplayName()}
                  </div>
                </div>
              </div>
            ) : (
              // User not logged in - show login button only
              <>
                <div className="flex items-center gap-3 px-2 py-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-purple-900
                                flex items-center justify-center border border-gray-700">
                    <PersonIcon sx={{ fontSize: 18 }} className="text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-gray-500 text-xs">Xin chào!</div>
                    <div className="text-gray-300 text-sm font-medium">Khách</div>
                  </div>
                </div>

                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center w-full py-3.5 px-4
                            rounded-xl font-semibold text-[15px]
                            bg-gradient-to-r from-purple-600 to-indigo-600
                            hover:from-purple-500 hover:to-indigo-500
                            text-white
                            transition-all duration-200 active:scale-[0.98]"
                >
                  Đăng nhập
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
