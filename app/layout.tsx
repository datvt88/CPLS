import './globals.css'
import { Providers } from '@/components/Providers'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Footer from '../components/Footer'
import AuthListener from '../components/AuthListener'

export const metadata = {
  title: 'Master Trader',
  verification: {
    other: {
      'zalo-platform-site-verification': 'FyJcAj-pL2y9k-C7oerBNZgdwddMqJmlDZWp',
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col md:flex-row bg-[--bg] text-white overflow-x-hidden">
            <AuthListener />
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full">
              <Header />
              <main className="container py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8 max-w-full">{children}</main>
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
