import './globals.css'
import { Roboto } from 'next/font/google'
import { Providers } from '@/components/Providers'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import Footer from '../components/Footer'
import AuthListener from '../components/AuthListener'

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata = {
  title: 'Cổ Phiếu Lướt Sóng',
  description: 'Master Trader - Nền tảng giao dịch chứng khoán thông minh',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  verification: {
    other: {
      'zalo-platform-site-verification': 'FyJcAj-pL2y9k-C7oerBNZgdwddMqJmlDZWp',
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={roboto.variable}>
        <Providers>
          <div className="min-h-screen flex flex-col md:flex-row bg-[--bg] text-white overflow-x-hidden">
            <AuthListener />
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 w-full">
              <Header />
              <main className="container py-3 sm:py-4 md:py-5 lg:py-6 max-w-full">{children}</main>
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
