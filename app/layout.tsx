import './globals.css'
import { Providers } from '@/components/Providers'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Footer from '../components/Footer'
import AuthListener from '../components/AuthListener'

export const metadata = { title: 'Master Trader' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          <div className="min-h-screen flex bg-[--bg] text-white">
            <AuthListener />
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              <main className="container py-6">{children}</main>
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
