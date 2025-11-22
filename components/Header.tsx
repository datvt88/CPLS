'use client'
import MobileMenu from './MobileMenu'

export default function Header(){
  return (
    <header className="bg-transparent border-b border-gray-800 sticky top-0 z-30 backdrop-blur-sm bg-black/50">
      <div className="container flex items-center justify-between py-3 px-4 sm:px-6">
        <div className="text-xs sm:text-sm text-[--muted] truncate">Cổ Phiếu Lướt Sóng</div>
        <MobileMenu />
      </div>
    </header>
  )
}
