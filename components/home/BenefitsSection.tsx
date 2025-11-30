'use client';

import DevicesIcon from '@mui/icons-material/Devices';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import BarChartIcon from '@mui/icons-material/BarChart';

export default function BenefitsSection() {
  return (
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
  );
}
