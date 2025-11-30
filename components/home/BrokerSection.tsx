'use client';

import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

export default function BrokerSection() {
  const handleOpenAccount = (broker: string) => {
    const urls: Record<string, string> = {
      tcbs: 'https://www.tcbs.com.vn/mo-tai-khoan',
      ssi: 'https://www.ssi.com.vn/khach-hang-ca-nhan/mo-tai-khoan',
      vietcap: 'https://www.vietcap.com.vn/mo-tai-khoan-chung-khoan'
    };
    window.open(urls[broker], '_blank');
  };

  return (
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
  );
}
