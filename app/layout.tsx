import './globals.css'
import { ThemeProvider } from 'next-themes'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import AuthListener from '../components/AuthListener'

export const metadata = { title: 'CPLS - Trading Dashboard' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="dark">
          <div className="min-h-screen flex bg-[--bg] text-white">
            <AuthListener />
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              <main className="container py-6">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
