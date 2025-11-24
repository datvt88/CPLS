'use client'
import MobileMenu from './MobileMenu'

export default function Header(){
  return (
    <header className="border-b sticky top-0 z-30 backdrop-blur-md bg-[--header-bg]/95 border-[--border] dark:border-gray-800 dark:bg-black/50">
      <div className="flex items-center justify-between py-2.5 sm:py-3 px-3 sm:px-4 md:px-5 lg:px-6">
        <div className="text-xs sm:text-sm text-[--text-muted] dark:text-[--muted] font-semibold truncate">Cổ Phiếu Lướt Sóng</div>
        <MobileMenu />
      </div>
    </header>
  )
}
