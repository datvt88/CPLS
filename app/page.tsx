'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import InsightsIcon from '@mui/icons-material/Insights';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DevicesIcon from '@mui/icons-material/Devices';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import BarChartIcon from '@mui/icons-material/BarChart';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in and redirect
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.push('/dashboard');
      } else {
        setIsLoading(false);
      }
    };
    checkUser();

    // Listen for auth changes and redirect
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        router.push('/dashboard');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const handleGetStarted = () => {
    router.push('/login');
  };

  const handleOpenAccount = (broker: string) => {
    const urls: Record<string, string> = {
      tcbs: 'https://www.tcbs.com.vn/mo-tai-khoan',
      ssi: 'https://www.ssi.com.vn/khach-hang-ca-nhan/mo-tai-khoan',
      vietcap: 'https://www.vietcap.com.vn/mo-tai-khoan-chung-khoan'
    };
    window.open(urls[broker], '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-green-900/20"></div>
        <div className="container relative px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8">
            {/* Logo */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="bg-gradient-to-br from-green-400 to-emerald-500 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-lg shadow-green-500/20">
                <TrendingUpIcon sx={{ fontSize: { xs: 48, sm: 64, md: 80 } }} className="text-black" />
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
                Bắt đầu ngay
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-purple-500 hover:bg-purple-500/10 text-purple-400 hover:text-purple-300 font-semibold rounded-xl transition-all duration-300"
              >
                Đăng nhập
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-[--panel]">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                Công cụ phân tích chuyên nghiệp
              </h2>
              <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
                Tất cả công cụ bạn cần để phân tích và đưa ra quyết định đầu tư thông minh
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Feature 1 */}
              <div className="bg-[--bg] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 group">
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <ShowChartIcon sx={{ fontSize: { xs: 28, sm: 32 } }} className="text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">Biểu đồ kỹ thuật</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Biểu đồ chuyên nghiệp với các chỉ báo kỹ thuật phổ biến,
                  giúp phân tích xu hướng giá một cách chính xác.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[--bg] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-green-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10 group">
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <PsychologyIcon sx={{ fontSize: { xs: 28, sm: 32 } }} className="text-black" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">Tín hiệu AI</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Trí tuệ nhân tạo phân tích dữ liệu thị trường,
                  cung cấp tín hiệu mua bán chính xác và kịp thời.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[--bg] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-cyan-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10 group">
                <div className="bg-gradient-to-br from-cyan-400 to-blue-500 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <InsightsIcon sx={{ fontSize: { xs: 28, sm: 32 } }} className="text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">Phân tích sâu</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Báo cáo tài chính chi tiết, phân tích cơ bản và kỹ thuật
                  giúp đánh giá giá trị thực của doanh nghiệp.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-[--bg] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 group">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <SpeedIcon sx={{ fontSize: { xs: 28, sm: 32 } }} className="text-black" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">Dữ liệu realtime</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Cập nhật giá cổ phiếu theo thời gian thực,
                  theo dõi biến động thị trường mọi lúc mọi nơi.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-[--bg] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-red-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10 group">
                <div className="bg-gradient-to-br from-red-400 to-pink-500 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUpIcon sx={{ fontSize: { xs: 28, sm: 32 } }} className="text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">Top cổ phiếu</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Danh sách các cổ phiếu hot nhất,
                  tăng giảm mạnh và khối lượng giao dịch lớn.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-[--bg] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 group">
                <div className="bg-gradient-to-br from-indigo-400 to-purple-500 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                  <SecurityIcon sx={{ fontSize: { xs: 28, sm: 32 } }} className="text-white" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3">An toàn & bảo mật</h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                  Dữ liệu được mã hóa, bảo mật tuyệt đối
                  cho thông tin cá nhân và danh mục đầu tư của bạn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 md:gap-12">
              {/* Benefit 1 - Multi-device */}
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-gradient-to-br from-orange-400 to-orange-500 p-6 rounded-full">
                    <DevicesIcon sx={{ fontSize: { xs: 48, sm: 56, md: 64 } }} className="text-white" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3 uppercase tracking-wide">
                  Chuyên biệt cho<br />giao dịch chứng khoán
                </h3>
              </div>

              {/* Benefit 2 - Money/Opportunities */}
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-gradient-to-br from-orange-400 to-orange-500 p-6 rounded-full">
                    <MonetizationOnIcon sx={{ fontSize: { xs: 48, sm: 56, md: 64 } }} className="text-white" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3 uppercase tracking-wide">
                  Chủ động<br />tối ưu cơ hội
                </h3>
              </div>

              {/* Benefit 3 - Analytics/Insights */}
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-gradient-to-br from-orange-400 to-orange-500 p-6 rounded-full">
                    <BarChartIcon sx={{ fontSize: { xs: 48, sm: 56, md: 64 } }} className="text-white" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-3 uppercase tracking-wide">
                  Thông tin & tư vấn<br />chuyên sâu
                </h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Broker CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-[--panel]">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-10 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                Ứng dụng miễn phí khi nhà đầu tư cùng đồng hành
              </h2>
              <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
                Chúng tôi đồng hành cùng các nhà môi giới uy tín hàng đầu Việt Nam.
                Mở tài khoản miễn phí và bắt đầu hành trình đầu tư của bạn ngay hôm nay.
              </p>
            </div>

            {/* Broker Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* TCBS */}
              <div className="bg-[--panel] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-green-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20 group text-center">
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <AccountBalanceIcon sx={{ fontSize: { xs: 32, sm: 40 } }} className="text-black" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">TCBS</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6">
                  Chứng khoán Kỹ thương
                </p>
                <button
                  onClick={() => handleOpenAccount('tcbs')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-black font-bold rounded-lg transition-all duration-300 shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:scale-105"
                >
                  Mở tài khoản
                </button>
              </div>

              {/* SSI */}
              <div className="bg-[--panel] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-red-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20 group text-center">
                <div className="bg-gradient-to-br from-red-500 to-orange-500 w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <AccountBalanceIcon sx={{ fontSize: { xs: 32, sm: 40 } }} className="text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">SSI</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6">
                  Chứng khoán SSI
                </p>
                <button
                  onClick={() => handleOpenAccount('ssi')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold rounded-lg transition-all duration-300 shadow-lg shadow-red-500/20 hover:shadow-red-500/40 hover:scale-105"
                >
                  Mở tài khoản
                </button>
              </div>

              {/* Vietcap */}
              <div className="bg-[--panel] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-lime-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-lime-500/20 group text-center">
                <div className="bg-gradient-to-br from-lime-400 to-green-500 w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <AccountBalanceIcon sx={{ fontSize: { xs: 32, sm: 40 } }} className="text-black" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Vietcap</h3>
                <p className="text-sm sm:text-base text-gray-400 mb-6">
                  Chứng khoán Bản Việt
                </p>
                <button
                  onClick={() => handleOpenAccount('vietcap')}
                  className="w-full px-6 py-3 bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-500 hover:to-green-600 text-black font-bold rounded-lg transition-all duration-300 shadow-lg shadow-lime-500/20 hover:shadow-lime-500/40 hover:scale-105"
                >
                  Mở tài khoản
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-8 sm:mt-10 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-4 sm:p-6 border border-yellow-700/30">
              <p className="text-xs sm:text-sm text-gray-300 text-center leading-relaxed">
                Miễn phí tính năng phân tích cổ phiếu cho tất cả người dùng
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
