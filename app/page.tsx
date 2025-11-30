'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';

// Lazy load below-the-fold sections
const FeaturesSection = dynamic(() => import('@/components/home/FeaturesSection'), {
  loading: () => <div className="py-24 bg-[--panel]" />,
});

const BenefitsSection = dynamic(() => import('@/components/home/BenefitsSection'), {
  loading: () => <div className="py-24" />,
});

const BrokerSection = dynamic(() => import('@/components/home/BrokerSection'), {
  loading: () => <div className="py-24 bg-[--panel]" />,
});

export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is already logged in (non-blocking)
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);
    };
    checkUser();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-green-900/20"></div>
        <div className="container relative px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            {/* Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg shadow-green-500/20">
                <Image
                  src="/logo.png"
                  alt="Cổ Phiếu Lướt Sóng Logo"
                  width={160}
                  height={160}
                  priority
                  className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 object-contain"
                  sizes="(max-width: 640px) 96px, (max-width: 768px) 128px, 160px"
                />
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Cổ Phiếu Lướt Sóng
            </h1>

            {/* Tagline */}
            <p className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto">
              Nền tảng phân tích cổ phiếu thông minh với AI
            </p>

            {/* Description */}
            <p className="text-sm sm:text-base md:text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Công cụ phân tích chuyên sâu giúp nhà đầu tư cá nhân ra quyết định thông minh hơn
              với dữ liệu thời gian thực, tín hiệu giao dịch AI và biểu đồ kỹ thuật chuyên nghiệp.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <button
                onClick={handleGetStarted}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-black font-bold rounded-xl transition-all duration-300 shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105"
              >
                {isLoggedIn ? 'Vào Dashboard' : 'Bắt đầu ngay'}
              </button>
              {!isLoggedIn && (
                <button
                  onClick={() => router.push('/login')}
                  className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-purple-500 hover:bg-purple-500/10 text-purple-400 hover:text-purple-300 font-semibold rounded-xl transition-all duration-300"
                >
                  Đăng nhập
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Lazy-loaded Sections */}
      <FeaturesSection />
      <BenefitsSection />
      <BrokerSection />
    </div>
  );
}
