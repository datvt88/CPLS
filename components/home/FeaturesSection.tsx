'use client';

import ShowChartIcon from '@mui/icons-material/ShowChart';
import PsychologyIcon from '@mui/icons-material/Psychology';
import InsightsIcon from '@mui/icons-material/Insights';
import SpeedIcon from '@mui/icons-material/Speed';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';

export default function FeaturesSection() {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-[--panel]">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              Công cụ phân tích cổ phiếu chuyên nghiệp nhất
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto">
              Đơn giản hóa việc phân tích và đưa ra quyết định đầu tư thông minh
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
                Phân tích cơ bản và kỹ thuật
                giúp đánh giá giá trị hiện tại của doanh nghiệp.
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
                bộ lọc các cổ phiếu tiềm năng trong ngày. 
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-[--bg] rounded-xl sm:rounded-2xl p-6 sm:p-8 border border-gray-800 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 group">
              <div className="bg-gradient-to-br from-indigo-400 to-purple-500 w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300">
                <SecurityIcon sx={{ fontSize: { xs: 28, sm: 32 } }} className="text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-3">An toàn & bảo mật</h3>
              <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                Dữ liệu được mã hóa, bảo mật cao
                an toàn và riêng tư.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
