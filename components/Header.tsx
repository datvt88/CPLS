'use client'
import Image from 'next/image'
import MobileMenu from './MobileMenu'

export default function Header(){
  return (
    <header className="bg-transparent border-b border-gray-800 sticky top-0 z-30 backdrop-blur-sm bg-black/50">
      <div className="flex items-center justify-between py-2.5 sm:py-3 px-3 sm:px-4 md:px-5 lg:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <Image
            src="/logo.png"
            alt="CPLS Logo"
            width={32}
            height={32}
            className="w-7 h-7 sm:w-8 sm:h-8"
            priority
          />
          <div className="text-sm sm:text-base font-medium text-white">Cổ Phiếu Lướt Sóng</div>
        </div>
        <MobileMenu />
      </div>
    </header>
  )
}
