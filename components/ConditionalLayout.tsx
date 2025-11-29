'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  if (isHomePage) {
    // Home page: no sidebar, no header, no footer
    return <>{children}</>;
  }

  // Other pages: with sidebar, header, and footer
  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Header />
        <main className="container py-3 sm:py-4 md:py-5 lg:py-6 max-w-full">{children}</main>
        <Footer />
      </div>
    </>
  );
}
