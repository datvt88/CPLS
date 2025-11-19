'use client'

import Link from 'next/link'
import MobileMenu from './MobileMenu'

export default function Header() {
  return (
    <header className="bg-transparent border-b border-gray-800 sticky top-0 z-30 backdrop-blur-sm bg-[--panel]/80">
      <div className="container flex items-center justify-between py-3 sm:py-4">
        {/* Logo / Branding */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
        >
          {/* Logo for mobile */}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
            CPLS
          </div>

          {/* Text branding - show on larger screens */}
          <div className="hidden xs:block">
            <div className="text-sm sm:text-base font-semibold text-white">
              Cổ Phiếu Lướt Sóng
            </div>
            <div className="text-xs text-[--muted] hidden sm:block">
              Master Trader
            </div>
          </div>
        </Link>

        {/* Mobile Menu - visible only on mobile */}
        <div className="md:hidden">
          <MobileMenu />
        </div>

        {/* Desktop Actions - visible only on desktop */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[--panel]"
          >
            Đăng nhập
          </Link>
        </div>
      </div>
    </header>
  )
}
