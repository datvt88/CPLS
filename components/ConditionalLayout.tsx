'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isNoFooterPage = pathname === '/chat' || pathname === '/profile' || pathname === '/management';

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

  if (isNoFooterPage) {
    // Chat, Profile, Management pages: with sidebar and header, no footer
    return (
      <div className="min-h-screen flex flex-col md:flex-row w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 w-full">
          <Header />
          <main className="container py-3 sm:py-4 md:py-5 lg:py-6 max-w-full flex-1">{children}</main>
        </div>
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
