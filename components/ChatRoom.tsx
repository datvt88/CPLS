'use client'

import { useState, useEffect, useRef } from 'react'
import { database } from '@/lib/firebaseClient'
import { ref, push, onValue, off, serverTimestamp, query, orderByChild, limitToLast } from 'firebase/database'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'

interface Message {
  id: string
  text: string
  userId: string
  username: string
  avatar?: string
  timestamp: number
  createdAt?: any
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<{ id: string; profile: Profile } | null>(null)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    const messagesRef = ref(database, 'messages')
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(100))

    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const messagesList: Message[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id,
          text: msg.text,
          userId: msg.userId,
          username: msg.username,
          avatar: msg.avatar,
          timestamp: msg.timestamp,
        }))
        setMessages(messagesList.sort((a, b) => a.timestamp - b.timestamp))
      } else {
        setMessages([])
      }
      setLoading(false)
    })

    return () => {
      off(messagesRef)
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadCurrentUser = async () => {
    try {
      const { user } = await authService.getUser()
      if (user) {
        const { profile } = await profileService.getProfile(user.id)
        if (profile) {
          setCurrentUser({ id: user.id, profile })
        }
      }
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !currentUser) return

    try {
      const messagesRef = ref(database, 'messages')
      await push(messagesRef, {
        text: newMessage.trim(),
        userId: currentUser.id,
        username: currentUser.profile.full_name || currentUser.profile.email || 'Anonymous',
        avatar: currentUser.profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.profile.full_name || 'A')}&background=random`,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      })

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 48) {
      return 'Hôm qua ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' +
             date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Đang tải chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--panel] rounded-xl border border-gray-800 flex flex-col h-[600px]">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
          💬
        </div>
        <div>
          <h3 className="text-[--fg] font-semibold">Room Chat</h3>
          <p className="text-[--muted] text-sm">
            {messages.length > 0 ? `${messages.length} tin nhắn` : 'Chưa có tin nhắn'}
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-[--muted] py-8">
            <p>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = currentUser?.id === message.userId

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <img
                    src={message.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.username)}&background=random`}
                    alt={message.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                </div>

                {/* Message Content */}
                <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-semibold ${isOwnMessage ? 'text-purple-400' : 'text-blue-400'}`}>
                      {message.username}
                    </span>
                    <span className="text-xs text-[--muted]">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>

                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isOwnMessage
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-gray-800 text-[--fg]'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-gray-800 text-[--fg] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 placeholder-gray-500"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 text-white px-6 py-3 rounded-xl transition-all disabled:cursor-not-allowed font-semibold"
          >
            Gửi
          </button>
        </div>
        {currentUser && (
          <p className="text-xs text-[--muted] mt-2">
            Đang chat với tư cách: {currentUser.profile.full_name || currentUser.profile.email}
          </p>
        )}
      </form>
    </div>
  )
}
