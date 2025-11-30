export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-800 bg-[--panel]">
      <div className="container py-6">
        <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-xl p-4 border border-yellow-700/30">
          <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            ⚠️ Lưu ý miễn trừ trách nhiệm
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            Dữ liệu website được lấy từ các nguồn công khai trực tuyến.
            Công cụ bao gồm nội dung được tạo bởi AI phục vụ mục đích thử nghiệm và tham khảo riêng tư.
            Không khuyến khích thay thế con người để ra các quyết định đầu tư.
          </p>
        </div>
      </div>
    </footer>
  )
}
