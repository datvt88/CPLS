'use client'
import ThemeToggle from './ThemeToggle'
import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-transparent border-b border-gray-800">
      <div className="container flex items-center justify-between py-3">
        <div className="text-sm text-muted">CPLS — AI trading signals</div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-muted hover:text-foreground transition-colors">
            Login
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
