'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname?.startsWith('/auth/');

  if (isHomePage) {
    // Home page: full width, no sidebar, no header, no footer
    return <div className="w-full">{children}</div>;
  }

  if (isAuthPage) {
    // Auth pages (login/register): with header, no sidebar, no footer
    return (
      <div className="min-h-screen flex flex-col w-full">
        <Header />
        <main className="flex-1 w-full">{children}</main>
      </div>
    );
  }

  // Other pages: with sidebar, header, and footer in flex layout
  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Header />
        <main className="container py-3 sm:py-4 md:py-5 lg:py-6 max-w-full">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
