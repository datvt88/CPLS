'use client'

import { useState, useEffect, useRef } from 'react'
import { database, storage } from '@/lib/firebaseClient'
import { ref as dbRef, push, onValue, off, serverTimestamp, query, orderByChild, limitToLast, update, get } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'

interface Reaction {
  userId: string
  username: string
  type: 'like' | 'love' | 'sad'
}

interface Message {
  id: string
  text: string
  userId: string
  username: string
  avatar?: string
  timestamp: number
  imageUrl?: string
  replyTo?: {
    messageId: string
    text: string
    username: string
  }
  reactions?: { [key: string]: Reaction }
  readBy?: { [userId: string]: number }
}

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '👏', '🎉', '🔥', '💯', '❤️', '🚀', '💪', '🙏', '✅']

const REACTION_TYPES = [
  { type: 'like', emoji: '👍', label: 'Thích' },
  { type: 'love', emoji: '❤️', label: 'Yêu thích' },
  { type: 'sad', emoji: '😢', label: 'Buồn' }
] as const

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<{ id: string; profile: Profile } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [showReactions, setShowReactions] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    const messagesRef = dbRef(database, 'messages')
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(100))

    const unsubscribe = onValue(
      messagesQuery,
      (snapshot) => {
        try {
          const data = snapshot.val()
          if (data) {
            const messagesList: Message[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
              id,
              text: msg.text,
              userId: msg.userId,
              username: msg.username,
              avatar: msg.avatar,
              timestamp: msg.timestamp,
              imageUrl: msg.imageUrl,
              replyTo: msg.replyTo,
              reactions: msg.reactions || {},
              readBy: msg.readBy || {}
            }))
            setMessages(messagesList.sort((a, b) => a.timestamp - b.timestamp))

            // Mark messages as read
            if (currentUser) {
              markMessagesAsRead(messagesList)
            }
          } else {
            setMessages([])
          }
          setLoading(false)
          setError(null)
        } catch (err) {
          console.error('Error processing messages:', err)
          setError('Có lỗi khi tải tin nhắn')
          setLoading(false)
        }
      },
      (error) => {
        console.error('Firebase onValue error:', error)
        setError('Không thể kết nối đến Firebase. Vui lòng kiểm tra cấu hình.')
        setLoading(false)
      }
    )

    return () => {
      off(messagesRef)
    }
  }, [currentUser])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmoji(false)
      }
    }

    if (showEmoji) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmoji])

  // Handle paste event for images (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // Check if the item is an image
        if (item.type.startsWith('image/')) {
          e.preventDefault()

          const file = item.getAsFile()
          if (file) {
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
              alert('Kích thước ảnh tối đa 5MB!')
              return
            }

            setSelectedImage(file)
            const reader = new FileReader()
            reader.onloadend = () => {
              setImagePreview(reader.result as string)
            }
            reader.readAsDataURL(file)

            // Focus back on input
            messageInputRef.current?.focus()
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)

    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [])

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

  const markMessagesAsRead = async (messagesList: Message[]) => {
    if (!currentUser) return

    const updates: { [key: string]: any } = {}

    messagesList.forEach((msg) => {
      // Don't mark own messages or already read messages
      if (msg.userId !== currentUser.id && (!msg.readBy || !msg.readBy[currentUser.id])) {
        updates[`messages/${msg.id}/readBy/${currentUser.id}`] = Date.now()
      }
    })

    if (Object.keys(updates).length > 0) {
      await update(dbRef(database), updates)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Helper function to get display name (priority: nickname > full_name > email)
  const getDisplayName = (profile: Profile): string => {
    return profile.nickname || profile.full_name || profile.email || 'Anonymous'
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        alert('Chỉ được phép gửi hình ảnh!')
        return
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Kích thước ảnh tối đa 5MB!')
        return
      }

      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const timestamp = Date.now()
    const fileName = `chat-images/${currentUser?.id}/${timestamp}_${file.name}`
    const imageRef = storageRef(storage, fileName)

    await uploadBytes(imageRef, file)
    const downloadURL = await getDownloadURL(imageRef)

    return downloadURL
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if ((!newMessage.trim() && !selectedImage) || !currentUser) return

    try {
      setUploading(true)

      let imageUrl: string | undefined = undefined

      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage)
      }

      const messagesRef = dbRef(database, 'messages')
      const displayName = getDisplayName(currentUser.profile)
      const messageData: any = {
        text: newMessage.trim() || (imageUrl ? '[Hình ảnh]' : ''),
        userId: currentUser.id,
        username: displayName,
        avatar: currentUser.profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
      }

      if (imageUrl) {
        messageData.imageUrl = imageUrl
      }

      if (replyingTo) {
        messageData.replyTo = {
          messageId: replyingTo.id,
          text: replyingTo.text,
          username: replyingTo.username
        }
      }

      await push(messagesRef, messageData)

      setNewMessage('')
      setSelectedImage(null)
      setImagePreview(null)
      setReplyingTo(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Có lỗi xảy ra khi gửi tin nhắn!')
    } finally {
      setUploading(false)
    }
  }

  const handleReaction = async (messageId: string, reactionType: 'like' | 'love' | 'sad') => {
    if (!currentUser) return

    const messageRef = dbRef(database, `messages/${messageId}/reactions/${currentUser.id}`)
    const snapshot = await get(messageRef)

    if (snapshot.exists() && snapshot.val().type === reactionType) {
      // Remove reaction if clicking the same type
      await update(dbRef(database, `messages/${messageId}/reactions`), {
        [currentUser.id]: null
      })
    } else {
      // Add or update reaction
      const displayName = getDisplayName(currentUser.profile)
      await update(dbRef(database, `messages/${messageId}/reactions`), {
        [currentUser.id]: {
          userId: currentUser.id,
          username: displayName,
          type: reactionType
        }
      })
    }

    setShowReactions(null)
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const isToday = date.toDateString() === today.toDateString()
    const isYesterday = date.toDateString() === yesterday.toDateString()

    if (isToday) return 'Hôm nay'
    if (isYesterday) return 'Hôm qua'
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const shouldShowDateDivider = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return true

    const currentDate = new Date(currentMessage.timestamp).toDateString()
    const previousDate = new Date(previousMessage.timestamp).toDateString()

    return currentDate !== previousDate
  }

  const getReactionCounts = (reactions?: { [key: string]: Reaction }) => {
    if (!reactions) return {}

    const counts: { [key: string]: number } = {}
    Object.values(reactions).forEach(reaction => {
      if (reaction && reaction.type) {
        counts[reaction.type] = (counts[reaction.type] || 0) + 1
      }
    })

    return counts
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

  if (error) {
    return (
      <div className="bg-[--panel] rounded-xl border border-red-800 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-400 mb-2">Lỗi kết nối</h3>
          <p className="text-[--muted] mb-4">{error}</p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-left">
            <p className="text-yellow-400 font-semibold mb-2">💡 Hướng dẫn khắc phục:</p>
            <ol className="text-[--muted] space-y-1 list-decimal list-inside">
              <li>Kiểm tra Firebase Realtime Database Rules đã được cấu hình chưa</li>
              <li>Xem file <code className="bg-gray-800 px-1 rounded">FIREBASE_SETUP.md</code> để biết chi tiết</li>
              <li>Refresh trang (Ctrl+Shift+R)</li>
              <li>Kiểm tra console (F12) để xem chi tiết lỗi</li>
            </ol>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Tải lại trang
          </button>
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
          messages.map((message, index) => {
            const isOwnMessage = currentUser?.id === message.userId
            const reactionCounts = getReactionCounts(message.reactions)
            const userReaction = message.reactions?.[currentUser?.id || '']
            const previousMessage = index > 0 ? messages[index - 1] : null
            const showDateDivider = shouldShowDateDivider(message, previousMessage)

            return (
              <div key={message.id}>
                {/* Date Divider */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-gray-800/50 px-3 py-1 rounded-full text-xs text-[--muted]">
                      {formatDate(message.timestamp)}
                    </div>
                  </div>
                )}

                {/* Message Row - All aligned to left */}
                <div className="flex gap-3 group">
                  {/* Avatar - Always on left */}
                  <div className="flex-shrink-0">
                    <img
                      src={message.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.username)}&background=random`}
                      alt={message.username}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  </div>

                  {/* Message Content */}
                  <div className="flex flex-col max-w-[70%] items-start flex-1">
                    {/* Username and Time */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[--fg]">
                        {message.username}
                      </span>
                      <span className="text-xs text-[--muted]">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>

                    {/* Reply Reference */}
                    {message.replyTo && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-gray-800/50 border-l-2 border-blue-500 text-xs">
                        <div className="text-[--muted] mb-1">Trả lời {message.replyTo.username}</div>
                        <div className="text-gray-400 truncate">{message.replyTo.text}</div>
                      </div>
                    )}

                    {/* Message Bubble with reactions */}
                    <div className="relative">
                      <div className="px-4 py-2 rounded-2xl bg-gray-800 text-[--fg]">
                        {message.imageUrl && (
                          <img
                            src={message.imageUrl}
                            alt="Shared image"
                            className="rounded-lg mb-2 max-w-sm max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(message.imageUrl, '_blank')}
                          />
                        )}
                        {message.text && message.text !== '[Hình ảnh]' && (
                          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                        )}
                      </div>

                      {/* Reactions Display - Bottom Right Corner */}
                      {Object.keys(reactionCounts).length > 0 && (
                        <div className="absolute -bottom-2 right-2 flex gap-1">
                          {Object.entries(reactionCounts).map(([type, count]) => {
                            const emoji = REACTION_TYPES.find(r => r.type === type)?.emoji
                            return (
                              <div
                                key={type}
                                className="bg-gray-700 rounded-full px-2 py-0.5 flex items-center gap-1 text-xs shadow-lg border border-gray-600"
                              >
                                <span>{emoji}</span>
                                <span className="text-gray-300">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Action Buttons (visible on hover) - Always on right */}
                      <div className="absolute top-0 right-0 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 px-2">
                        {/* Reply Button */}
                        <button
                          onClick={() => setReplyingTo(message)}
                          className="bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded-full text-xs"
                          title="Trả lời"
                        >
                          ↩️
                        </button>

                        {/* Reaction Button */}
                        <button
                          onClick={() => setShowReactions(showReactions === message.id ? null : message.id)}
                          className="bg-gray-700 hover:bg-gray-600 text-white p-1.5 rounded-full text-xs"
                          title="Thả cảm xúc"
                        >
                          {userReaction ? REACTION_TYPES.find(r => r.type === userReaction.type)?.emoji : '❤️'}
                        </button>
                      </div>

                      {/* Reaction Picker */}
                      {showReactions === message.id && (
                        <div className="absolute top-full mt-2 left-0 bg-gray-800 rounded-lg shadow-lg p-2 flex gap-2 z-10 border border-gray-700">
                          {REACTION_TYPES.map(({ type, emoji, label }) => (
                            <button
                              key={type}
                              onClick={() => handleReaction(message.id, type)}
                              className="hover:scale-125 transition-transform text-2xl"
                              title={label}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying To Bar */}
      {replyingTo && (
        <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-700 flex items-center justify-between">
          <div className="flex-1">
            <div className="text-xs text-purple-400 mb-1">Đang trả lời {replyingTo.username}</div>
            <div className="text-sm text-gray-400 truncate">{replyingTo.text}</div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 py-2 bg-gray-800/50 border-t border-gray-700">
          <div className="relative inline-block">
            <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg" />
            <button
              onClick={() => {
                setImagePreview(null)
                setSelectedImage(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-800">
        <div className="flex gap-2 items-end">
          {/* Image Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-all"
            title="Gửi ảnh"
          >
            🖼️
          </button>

          {/* Emoji Button */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl transition-all"
              title="Emoji"
            >
              😀
            </button>

            {/* Emoji Picker */}
            {showEmoji && (
              <div className="absolute bottom-full mb-2 left-0 bg-gray-800 rounded-xl shadow-lg p-3 grid grid-cols-8 gap-2 border border-gray-700 z-10 w-80">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setNewMessage(newMessage + emoji)
                      setShowEmoji(false)
                      messageInputRef.current?.focus()
                    }}
                    className="hover:scale-125 transition-transform text-2xl w-10 h-10 flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Input */}
          <input
            ref={messageInputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Nhập tin nhắn hoặc Ctrl+V để paste ảnh..."
            className="flex-1 bg-gray-800 text-[--fg] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-600 placeholder-gray-500"
            maxLength={1000}
            disabled={uploading}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedImage) || uploading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 text-white px-6 py-3 rounded-xl transition-all disabled:cursor-not-allowed font-semibold"
          >
            {uploading ? '⏳' : 'Gửi'}
          </button>
        </div>
        {currentUser && (
          <p className="text-xs text-[--muted] mt-2">
            Đang chat với tư cách: {getDisplayName(currentUser.profile)}
          </p>
        )}
      </form>
    </div>
  )
}
