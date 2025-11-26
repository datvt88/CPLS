'use client'
import Link from 'next/link'
import Image from 'next/image'
import MobileMenu from './MobileMenu'

export default function Header(){
  return (
    <header className="bg-transparent border-b border-gray-800 sticky top-0 z-30 backdrop-blur-sm bg-black/50">
      <div className="flex items-center justify-between py-2.5 sm:py-3 px-3 sm:px-4 md:px-5 lg:px-6">
        <Link href="/dashboard" className="md:hidden hover:opacity-80 transition-opacity">
          <div className="relative w-24 h-6 sm:w-28 sm:h-7">
            <Image
              src="/logo.svg"
              alt="Cổ Phiếu Lướt Sóng"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>
        <div className="hidden md:block text-xs sm:text-sm text-[--muted] truncate">Cổ Phiếu Lướt Sóng</div>
        <MobileMenu />
      </div>
    </header>
  )
}
