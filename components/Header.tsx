'use client'
import MobileMenu from './MobileMenu'

export default function Header(){
  return (
    <header className="bg-transparent border-b border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <div className="text-sm text-[--muted]">Cổ Phiếu Lướt Sóng</div>
        <MobileMenu />
      </div>
    </header>
  )
}
