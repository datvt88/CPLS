// app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'Auto Trading App',
  description: 'Vietnam Stock Trading with AI Signals (Gemini + Supabase)',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <header className="p-4 bg-blue-600 text-white font-semibold shadow">
          Auto Trading App
        </header>
        <main className="min-h-screen p-4">{children}</main>
        <footer className="p-4 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Auto Trading AI
        </footer>
      </body>
    </html>
  )
}
