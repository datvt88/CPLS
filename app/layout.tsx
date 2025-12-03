import './globals.css'
import { Roboto } from 'next/font/google'
import { Providers } from '@/components/Providers'
import AuthListener from '../components/AuthListener'
import ConditionalLayout from '../components/ConditionalLayout'
import AnalyticsScripts from '../components/AnalyticsScripts'
import SupabaseConfigWarning from '../components/SupabaseConfigWarning'

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-roboto',
})

export const metadata = {
  title: 'Cổ Phiếu Lướt Sóng - Nền Tảng Phân Tích Cổ Phiếu Thông Minh Với AI',
  description: 'Master Trader - Công cụ phân tích cổ phiếu chuyên sâu với AI, tín hiệu giao dịch thời gian thực, biểu đồ kỹ thuật chuyên nghiệp. Hỗ trợ nhà đầu tư cá nhân đưa ra quyết định đầu tư thông minh.',
  keywords: [
    'cổ phiếu',
    'chứng khoán',
    'phân tích cổ phiếu',
    'tín hiệu giao dịch',
    'AI stock analysis',
    'biểu đồ kỹ thuật',
    'đầu tư chứng khoán',
    'VN Index',
    'TCBS',
    'SSI',
    'Vietcap',
    'trading signals',
    'stock market Vietnam',
  ],
  authors: [{ name: 'Cổ Phiếu Lướt Sóng' }],
  creator: 'Cổ Phiếu Lướt Sóng',
  publisher: 'Cổ Phiếu Lướt Sóng',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://cophieluotsong.com',
    siteName: 'Cổ Phiếu Lướt Sóng',
    title: 'Cổ Phiếu Lướt Sóng - Nền Tảng Phân Tích Cổ Phiếu Thông Minh Với AI',
    description: 'Công cụ phân tích cổ phiếu chuyên sâu với AI, tín hiệu giao dịch thời gian thực, biểu đồ kỹ thuật chuyên nghiệp.',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'Cổ Phiếu Lướt Sóng Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cổ Phiếu Lướt Sóng - Nền Tảng Phân Tích Cổ Phiếu Thông Minh',
    description: 'Công cụ phân tích cổ phiếu chuyên sâu với AI, tín hiệu giao dịch thời gian thực.',
    images: ['/logo.png'],
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  verification: {
    other: {
      'zalo-platform-site-verification': 'FyJcAj-pL2y9k-C7oerBNZgdwddMqJmlDZWp',
    },
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
  category: 'finance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={roboto.variable}>
        <Providers>
          <SupabaseConfigWarning />
          <div className="bg-[--bg] text-white overflow-x-hidden">
            <AuthListener />
            <AnalyticsScripts />
            <ConditionalLayout>{children}</ConditionalLayout>
          </div>
        </Providers>
      </body>
    </html>
  )
}
