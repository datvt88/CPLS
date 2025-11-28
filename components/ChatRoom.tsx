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
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCurrentUser()
    loadPinnedMessage()
  }, [])

  const loadPinnedMessage = () => {
    const pinnedRef = dbRef(database, 'chatRoomSettings/pinnedMessageId')
    onValue(pinnedRef, (snapshot) => {
      const pinnedId = snapshot.val()
      setPinnedMessageId(pinnedId)
    })
  }

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

  const handlePinMessage = async (messageId: string) => {
    if (!currentUser) return

    // Check if user is admin or mod
    if (currentUser.profile.role !== 'admin' && currentUser.profile.role !== 'mod') {
      alert('Chỉ admin/mod mới có thể ghim tin nhắn!')
      return
    }

    const pinnedRef = dbRef(database, 'chatRoomSettings/pinnedMessageId')

    // If already pinned, unpin it
    if (pinnedMessageId === messageId) {
      await update(dbRef(database, 'chatRoomSettings'), { pinnedMessageId: null })
    } else {
      // Pin the message
      await update(dbRef(database, 'chatRoomSettings'), { pinnedMessageId: messageId })
    }
  }

  const isAdminOrMod = () => {
    return currentUser?.profile.role === 'admin' || currentUser?.profile.role === 'mod'
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
      <div className="flex items-center justify-center h-96 bg-[#1a1a1a] rounded-2xl border border-gray-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Đang tải chat...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#1a1a1a] rounded-2xl border border-red-800/50 p-8 shadow-xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-400 mb-2">Lỗi kết nối</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-sm text-left">
            <p className="text-yellow-400 font-semibold mb-2">💡 Hướng dẫn khắc phục:</p>
            <ol className="text-gray-400 space-y-1 list-decimal list-inside">
              <li>Kiểm tra Firebase Realtime Database Rules đã được cấu hình chưa</li>
              <li>Xem file <code className="bg-gray-800 px-2 py-0.5 rounded">FIREBASE_SETUP.md</code> để biết chi tiết</li>
              <li>Refresh trang (Ctrl+Shift+R)</li>
              <li>Kiểm tra console (F12) để xem chi tiết lỗi</li>
            </ol>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30"
          >
            Tải lại trang
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 flex flex-col h-[600px] md:h-[700px] shadow-xl font-[var(--font-roboto,_sans-serif)] max-w-full overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center gap-3 bg-[#121212] flex-shrink-0">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
          💬
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-semibold text-base truncate">Kiếm tiền đi chợ</h3>
          <p className="text-gray-400 text-sm truncate">
            {messages.length > 0 ? `${messages.length} tin nhắn` : 'Chưa có tin nhắn'}
          </p>
        </div>
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-5 bg-[#0f0f0f]"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Pinned Message */}
        {pinnedMessageId && messages.find(m => m.id === pinnedMessageId) && (
          <div className="sticky top-0 z-10 mb-4 bg-gradient-to-r from-amber-900/50 to-amber-800/50 border border-amber-600/50 rounded-xl p-3 sm:p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="text-xl flex-shrink-0">📌</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-amber-300 mb-1 font-semibold">TIN NHẮN ĐƯỢC GHIM</div>
                {(() => {
                  const pinnedMsg = messages.find(m => m.id === pinnedMessageId)!
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <img
                          src={pinnedMsg.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(pinnedMsg.username)}&background=random`}
                          alt={pinnedMsg.username}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-sm font-semibold text-amber-100">{pinnedMsg.username}</span>
                        <span className="text-xs text-amber-300">{formatTime(pinnedMsg.timestamp)}</span>
                      </div>
                      {pinnedMsg.imageUrl && (
                        <img
                          src={pinnedMsg.imageUrl}
                          alt="Pinned image"
                          className="rounded-lg mb-2 max-w-full sm:max-w-xs max-h-32 object-cover cursor-pointer"
                          onClick={() => window.open(pinnedMsg.imageUrl, '_blank')}
                        />
                      )}
                      {pinnedMsg.text && pinnedMsg.text !== '[Hình ảnh]' && (
                        <p className="text-sm text-gray-200 break-words">{pinnedMsg.text}</p>
                      )}
                    </div>
                  )
                })()}
              </div>
              {isAdminOrMod() && (
                <button
                  onClick={() => handlePinMessage(pinnedMessageId)}
                  className="text-amber-300 hover:text-white transition-colors p-1 flex-shrink-0"
                  title="Bỏ ghim"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p className="text-sm">Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p>
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
                  <div className="flex items-center justify-center my-6">
                    <div className="bg-gray-800/40 px-4 py-1.5 rounded-full text-xs text-gray-400 font-medium">
                      {formatDate(message.timestamp)}
                    </div>
                  </div>
                )}

                {/* Message Row - All aligned to left */}
                <div className="flex gap-2 sm:gap-3 group hover:bg-[#1a1a1a]/30 -mx-2 sm:-mx-3 px-2 sm:px-3 py-1.5 rounded-lg transition-colors max-w-full">
                  {/* Avatar - Always on left */}
                  <div className="flex-shrink-0">
                    <img
                      src={message.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.username)}&background=random`}
                      alt={message.username}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-gray-700/50"
                    />
                  </div>

                  {/* Message Content */}
                  <div className="flex flex-col max-w-[calc(100%-3rem)] sm:max-w-[85%] md:max-w-[75%] lg:max-w-[70%] items-start flex-1 min-w-0">
                    {/* Username and Time */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-sm font-semibold ${isOwnMessage ? 'text-blue-400' : 'text-gray-200'}`}>
                        {message.username}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(message.timestamp)}
                      </span>
                    </div>

                    {/* Reply Reference - Inside message bubble */}
                    {message.replyTo && (
                      <div className="mb-2 px-3 py-2 rounded-lg bg-[#1a2634] border-l-2 border-[#5dade2] text-xs">
                        <div className="text-[#5dade2] mb-1 text-xs font-medium">{message.replyTo.username}</div>
                        <div className="text-gray-400 truncate text-xs">{message.replyTo.text}</div>
                      </div>
                    )}

                    {/* Message Bubble with reactions */}
                    <div className="relative max-w-full">
                      <div className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-md ${
                        isOwnMessage
                          ? 'bg-[#3d5a6b] text-white'
                          : 'bg-[#2c3e50] text-gray-100'
                      } max-w-full overflow-hidden`}>
                        {message.imageUrl && (
                          <img
                            src={message.imageUrl}
                            alt="Shared image"
                            className="rounded-xl mb-2 w-full max-w-full sm:max-w-sm max-h-48 sm:max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                            onClick={() => window.open(message.imageUrl, '_blank')}
                          />
                        )}
                        {message.text && message.text !== '[Hình ảnh]' && (
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed overflow-wrap-anywhere">{message.text}</p>
                        )}
                      </div>

                      {/* Reactions Display - Below message */}
                      {Object.keys(reactionCounts).length > 0 && (
                        <div className="flex gap-1.5 mt-1">
                          {Object.entries(reactionCounts).map(([type, count]) => {
                            const emoji = REACTION_TYPES.find(r => r.type === type)?.emoji
                            return (
                              <div
                                key={type}
                                className="bg-[#1a1a1a]/80 rounded-full px-2 py-0.5 flex items-center gap-1 text-xs shadow-md border border-gray-700/50"
                              >
                                <span>{emoji}</span>
                                <span className="text-gray-300 font-medium">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Action Buttons - Below message for all screens */}
                      <div className="flex gap-3 mt-2 opacity-70 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setReplyingTo(message)}
                          className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
                          title="Trả lời"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setShowReactions(showReactions === message.id ? null : message.id)}
                          className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
                          title="Thả cảm xúc"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {isAdminOrMod() && (
                          <button
                            onClick={() => handlePinMessage(message.id)}
                            className={`text-xs flex items-center gap-1 transition-colors ${
                              pinnedMessageId === message.id
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-gray-400 hover:text-white'
                            }`}
                            title={pinnedMessageId === message.id ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}
                          >
                            {pinnedMessageId === message.id ? '📌' : '📍'}
                          </button>
                        )}
                      </div>

                      {/* Reaction Picker */}
                      {showReactions === message.id && (
                        <div className="mt-2 bg-[#2a2a2a] rounded-xl shadow-2xl p-3 flex gap-3 border border-gray-700/50 backdrop-blur-md">
                          {REACTION_TYPES.map(({ type, emoji, label }) => (
                            <button
                              key={type}
                              onClick={() => handleReaction(message.id, type)}
                              className="hover:scale-125 transition-all text-xl sm:text-2xl hover:drop-shadow-lg"
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
        <div className="px-4 sm:px-5 py-3 bg-[#1a1a1a] border-t border-gray-800 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-blue-400 mb-1 font-medium truncate">Đang trả lời {replyingTo.username}</div>
            <div className="text-sm text-gray-400 truncate">{replyingTo.text}</div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 sm:px-5 py-3 bg-[#1a1a1a] border-t border-gray-800 flex-shrink-0 overflow-hidden">
          <div className="relative inline-block max-w-full">
            <img src={imagePreview} alt="Preview" className="max-h-32 max-w-full rounded-xl shadow-lg" />
            <button
              onClick={() => {
                setImagePreview(null)
                setSelectedImage(null)
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 md:p-5 border-t border-gray-800 bg-[#121212] flex-shrink-0">
        <div className="flex gap-2 sm:gap-3 items-end max-w-full">
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
            className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 p-2.5 sm:p-3 rounded-xl transition-all shadow-lg hover:scale-105 hover:shadow-blue-500/20"
            title="Gửi ảnh"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Emoji Button */}
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 p-2.5 sm:p-3 rounded-xl transition-all shadow-lg hover:scale-105 hover:shadow-blue-500/20"
              title="Emoji"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Emoji Picker */}
            {showEmoji && (
              <div className="absolute bottom-full mb-2 left-0 right-0 sm:left-0 sm:right-auto bg-[#2a2a2a] rounded-2xl shadow-2xl p-3 sm:p-4 grid grid-cols-6 sm:grid-cols-8 gap-1.5 sm:gap-2 border border-gray-700/50 z-10 max-w-[calc(100vw-2rem)] sm:w-80 backdrop-blur-md">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setNewMessage(newMessage + emoji)
                      setShowEmoji(false)
                      messageInputRef.current?.focus()
                    }}
                    className="hover:scale-125 transition-all text-xl sm:text-2xl w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-700/50 rounded-lg"
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
            placeholder="Nhập tin nhắn của bạn..."
            className="flex-1 min-w-0 bg-[#2a2a2a] text-gray-100 px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-gray-500 shadow-lg transition-all text-sm sm:text-base"
            maxLength={1000}
            disabled={uploading}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedImage) || uploading}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-700 disabled:to-gray-700 text-white p-3 sm:p-3.5 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:scale-105 hover:shadow-blue-500/30"
            title="Gửi tin nhắn"
          >
            {uploading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
        {currentUser && (
          <p className="text-xs text-gray-500 mt-3">
            Đang chat với tư cách: <span className="text-gray-400 font-medium">{getDisplayName(currentUser.profile)}</span>
          </p>
        )}
      </form>
    </div>
  )
}
