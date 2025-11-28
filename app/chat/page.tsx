'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import ChatRoom from '@/components/ChatRoom'

function ChatPageContent() {
  return (
    <div className="min-h-screen bg-[--bg] p-3 sm:p-6">
      <div className="w-full max-w-full sm:max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[--fg] mb-2">Kiếm tiền đi chợ</h1>
          <p className="text-[--muted] text-sm sm:text-base">Trò chuyện với cộng đồng trader</p>
        </div>

        {/* Chat Room Widget */}
        <ChatRoom />

        {/* Chat Guidelines */}
        <div className="mt-4 sm:mt-6 bg-[--panel] rounded-xl p-4 sm:p-6 border border-gray-800">
          <h3 className="text-[--fg] font-semibold mb-3 flex items-center gap-2">
            <span>📌</span>
            Quy tắc chat
          </h3>
          <ul className="text-[--muted] text-sm space-y-2">
            <li>• Tôn trọng các thành viên khác trong cộng đồng</li>
            <li>• Không spam, quảng cáo không liên quan</li>
            <li>• Chia sẻ kiến thức và kinh nghiệm đầu tư</li>
            <li>• Không đưa ra lời khuyên đầu tư không có cơ sở</li>
            <li>• Giữ gìn văn hóa giao tiếp lịch sự, thân thiện</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatPageContent />
    </ProtectedRoute>
  )
}
