'use client'

import React, { useState, useEffect, useRef, useMemo, memo } from 'react'
import { database, storage } from '@/lib/firebaseClient'
import { ref as dbRef, push, onValue, off, serverTimestamp, query, orderByChild, limitToLast, update, get, remove } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'

// 👇 IMPORT ĐÚNG FILE BẠN ĐÃ TẠO 👇
import { askGemini } from '@/app/chat/chat-gemini'

// --- Types & Constants ---
interface Message {
  id: string
  text: string
  userId: string
  username: string
  avatar?: string
  timestamp: number
  imageUrl?: string
  isEdited?: boolean
  replyTo?: { messageId: string, text: string, username: string }
  reactions?: { [key: string]: any }
}

const BOT_PROFILE = {
  id: 'alpha-bot-id',
  username: 'Alpha 🤖',
  avatar: 'https://ui-avatars.com/api/?name=Alpha&background=0D8ABC&color=fff&rounded=true&bold=true'
}

// --- Component Bong Bóng Chat ---
const MessageBubble = memo(({ message, isOwn, onReply, onDelete }: any) => {
  return (
    <div className={`flex w-full mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <img src={message.avatar} className="w-8 h-8 rounded-full mr-2 self-end" alt="avt" />
      )}
      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm break-words relative group ${
        isOwn ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-white rounded-bl-none'
      }`}>
        {/* Reply Context */}
        {message.replyTo && (
           <div className="mb-1 pl-2 border-l-2 border-white/50 text-xs opacity-75">
             <span className="font-bold">{message.replyTo.username}</span>: {message.replyTo.text}
           </div>
        )}
        
        {/* Nội dung tin nhắn */}
        {message.imageUrl && (
           <img src={message.imageUrl} alt="img" className="rounded-lg mb-2 max-h-48 object-cover" />
        )}
        <p>{message.text}</p>
        
        {/* Thời gian */}
        <div className="text-[10px] opacity-60 text-right mt-1">
          {new Date(message.timestamp).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}
        </div>

        {/* Nút Xóa (Chỉ hiện khi hover) */}
        {isOwn && (
          <button onClick={() => onDelete(message.id)} className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
            🗑️
          </button>
        )}
      </div>
    </div>
  )
})
MessageBubble.displayName = 'MessageBubble'

// --- Component Chính ---
export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<{ id: string; profile: Profile } | null>(null)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load User & Messages
  useEffect(() => {
    const loadData = async () => {
      const { user } = await authService.getUser()
      if (user) {
        const { profile } = await profileService.getProfile(user.id)
        setCurrentUser({ id: user.id, profile: profile || { role: 'user' } as any })
      }
    }
    loadData()

    const q = query(dbRef(database, 'messages'), orderByChild('timestamp'), limitToLast(50))
    return onValue(q, (snap) => {
      const data = snap.val()
      if (data) {
        const list = Object.entries(data).map(([id, m]: any) => ({ id, ...m }))
        setMessages(list.sort((a: any, b: any) => a.timestamp - b.timestamp))
      }
      setLoading(false)
    })
  }, [])

  // Auto Scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // --- HÀM GỬI TIN NHẮN & GỌI BOT ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser) return

    const userText = newMessage.trim()
    setNewMessage('') // Reset input ngay

    // 1. Gửi tin nhắn User lên Firebase
    const userMsg = {
      text: userText,
      userId: currentUser.id,
      username: currentUser.profile.nickname || currentUser.profile.email,
      avatar: currentUser.profile.avatar_url,
      timestamp: Date.now(),
      createdAt: serverTimestamp()
    }
    await push(dbRef(database, 'messages'), userMsg)

    // 2. KIỂM TRA GỌI BOT ALPHA
    if (userText.toLowerCase().startsWith('@alpha')) {
      const question = userText.replace(/^@alpha/i, '').trim()
      
      if (question) {
        // Gọi Server Action (Chạy trên Vercel)
        const response = await askGemini(question)

        if (response.text) {
          // Gửi câu trả lời của Bot lên Firebase
          const botMsg = {
            text: response.text,
            userId: BOT_PROFILE.id,
            username: BOT_PROFILE.username,
            avatar: BOT_PROFILE.avatar,
            timestamp: Date.now(),
            createdAt: serverTimestamp(),
            replyTo: {
              messageId: 'reply',
              text: userText,
              username: userMsg.username
            }
          }
          await push(dbRef(database, 'messages'), botMsg)
        } else if (response.error) {
          alert("Lỗi Alpha: " + response.error)
        }
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Xóa tin nhắn này?")) await remove(dbRef(database, `messages/${id}`))
  }

  if (loading) return <div className="text-white p-10 text-center">Đang tải Chat...</div>

  return (
    <div className="flex flex-col h-[600px] max-w-4xl mx-auto bg-[#1a202c] rounded-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-[#2d3748] text-white font-bold border-b border-gray-700 flex justify-between">
        <span>💬 Kiếm tiền đi chợ (Room Chat)</span>
        <span className="text-xs font-normal text-gray-400">Gõ @alpha để hỏi bot</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#1a202c]">
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            isOwn={msg.userId === currentUser?.id} 
            onDelete={handleDelete}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 bg-[#2d3748] flex gap-2">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Nhập tin nhắn... (@alpha để gọi bot)"
          className="flex-1 p-2 rounded bg-gray-700 text-white focus:outline-none"
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Gửi</button>
      </form>
    </div>
  )
}
