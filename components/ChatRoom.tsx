'use client'

import React, { useState, useEffect, useRef, useMemo, memo } from 'react'
import { database, storage } from '@/lib/firebaseClient'
import { ref as dbRef, push, onValue, off, serverTimestamp, query, orderByChild, limitToLast, update, get, remove } from 'firebase/database'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { authService } from '@/services/auth.service'
import { profileService, type Profile } from '@/services/profile.service'
// Import Server Action để gọi Bot
import { askGemini } from '@/app/chat/chat-gemini'

// --- Types ---
interface Reaction {
  userId: string
  username: string
  type: 'like' | 'love' | 'sad' | 'haha' | 'wow' | 'angry'
}

interface Message {
  id: string
  text: string
  userId: string
  username: string
  avatar?: string
  timestamp: number
  imageUrl?: string
  isEdited?: boolean
  replyTo?: {
    messageId: string
    text: string
    username: string
  }
  reactions?: { [key: string]: Reaction }
  readBy?: { [userId: string]: number }
}

// --- Constants ---
const REACTION_TYPES = [
  { type: 'like', emoji: '👍' },
  { type: 'love', emoji: '❤️' },
  { type: 'haha', emoji: '😂' },
  { type: 'wow', emoji: '😮' },
  { type: 'sad', emoji: '😢' },
  { type: 'angry', emoji: '😡' }
] as const

const BOT_PROFILE = {
  id: 'alpha-bot-id',
  username: 'Alpha 🤖',
  avatar: 'https://ui-avatars.com/api/?name=Alpha&background=0D8ABC&color=fff&rounded=true&bold=true'
}

// --- Helper Components ---

// 1. Lightbox (Xem ảnh full màn hình)
const Lightbox = ({ src, onClose }: { src: string, onClose: () => void }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-fadeIn" onClick={onClose}>
      <img src={src} alt="Full view" className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl object-contain" />
      <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2">✕</button>
    </div>
  )
}

// 2. Message Bubble (Bong bóng chat)
const MessageBubble = memo(({ 
  message, 
  isOwn, 
  isChain, 
  onReply, 
  onReact, 
  onPin, 
  onDelete, 
  onEdit,   
  onViewImage, 
  isAdminOrMod, 
  pinnedMessageId 
}: { 
  message: Message, 
  isOwn: boolean, 
  isChain: boolean,
  onReply: (msg: Message) => void,
  onReact: (id: string, type: any) => void,
  onPin: (id: string) => void,
  onDelete: (id: string) => void,
  onEdit: (msg: Message) => void,
  onViewImage: (url: string) => void,
  isAdminOrMod: boolean,
  pinnedMessageId: string | null
}) => {
  const [showActions, setShowActions] = useState(false)

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const reactionCounts = useMemo(() => {
    if (!message.reactions) return {}
    const counts: { [key: string]: number } = {}
    Object.values(message.reactions).forEach(r => {
      if (r?.type) counts[r.type] = (counts[r.type] || 0) + 1
    })
    return counts
  }, [message.reactions])

  return (
    <div 
      className={`group flex w-full mb-1 ${isOwn ? 'justify-end' : 'justify-start'} ${isChain ? 'mt-0.5' : 'mt-3'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isOwn && (
        <div className={`flex-shrink-0 w-8 mr-2 flex items-end ${isChain ? 'invisible' : ''}`}>
          <img 
            src={message.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.username)}`} 
            alt="Avt" 
            className="w-8 h-8 rounded-full bg-gray-700 object-cover"
          />
        </div>
      )}

      <div className={`relative max-w-[85%] sm:max-w-[70%] min-w-[80px]`}>
        <div className={`
          relative px-3 py-2 text-sm shadow-md break-words
          ${isOwn 
            ? 'bg-[#2b5278] text-white rounded-l-2xl rounded-tr-2xl rounded-br-md' 
            : 'bg-[#182533] text-white rounded-r-2xl rounded-tl-2xl rounded-bl-md'}
        `}>
          
          {message.replyTo && (
            <div className={`mb-2 pl-2 border-l-2 ${isOwn ? 'border-blue-300' : 'border-[#64d2ff]'} bg-black/10 rounded cursor-pointer p-1`}>
              <p className="text-xs font-bold opacity-80">{message.replyTo.username}</p>
              <p className="text-xs truncate opacity-70">{message.replyTo.text}</p>
            </div>
          )}

          {!isOwn && !isChain && (
            <p className="text-xs font-bold text-[#64d2ff] mb-1 cursor-pointer hover:underline">
              {message.username}
            </p>
          )}

          {message.imageUrl && (
            <div className="mb-2 rounded-lg overflow-hidden cursor-pointer group/img" onClick={() => onViewImage(message.imageUrl!)}>
              <img src={message.imageUrl} alt="Shared" className="max-w-full max-h-[300px] object-cover group-hover/img:scale-105 transition-transform duration-300" />
            </div>
          )}

          {message.text && message.text !== '[Hình ảnh]' && (
            <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
          )}

          <div className={`text-[10px] mt-1 flex items-center justify-end space-x-1 opacity-60`}>
            {message.isEdited && <span className="italic mr-1">(đã sửa)</span>}
            {message.id === pinnedMessageId && <span>📌</span>}
            <span>{formatTime(message.timestamp)}</span>
            {isOwn && <span>✓</span>}
          </div>

          {Object.keys(reactionCounts).length > 0 && (
            <div className={`absolute -bottom-3 ${isOwn ? 'left-0' : 'right-0'} bg-[#24303c] rounded-full px-1.5 py-0.5 shadow border border-gray-700 flex gap-1 z-10`}>
               {Object.entries(reactionCounts).map(([type, count]) => (
                 <span key={type} className="text-xs">{REACTION_TYPES.find(r => r.type === type)?.emoji} <span className="text-[10px]">{count}</span></span>
               ))}
            </div>
          )}
        </div>

        {/* Action Menu */}
        <div className={`
          absolute top-0 bottom-0 ${isOwn ? '-left-32 pr-2' : '-right-32 pl-2'} 
          flex items-center gap-1.5 transition-opacity duration-200
          ${showActions ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}>
           <button onClick={() => onReply(message)} className="p-1.5 bg-gray-700 rounded-full hover:bg-gray-600 text-gray-300" title="Trả lời">↩️</button>
           
           <div className="group/react relative">
              <button className="p-1.5 bg-gray-700 rounded-full hover:bg-gray-600 text-gray-300">❤️</button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex bg-[#1c2e3e] rounded-full p-1 shadow-lg gap-1 invisible group-hover/react:visible transition-all z-20 w-max">
                {REACTION_TYPES.map(r => (
                  <button key={r.type} onClick={() => onReact(message.id, r.type)} className="hover:scale-125 transition text-lg px-1">{r.emoji}</button>
                ))}
              </div>
           </div>

           {(isOwn || isAdminOrMod) && (
             <>
               {isOwn && !message.imageUrl && (
                  <button onClick={() => onEdit(message)} className="p-1.5 bg-gray-700 rounded-full hover:bg-blue-600 text-gray-300" title="Sửa">✏️</button>
               )}
               <button onClick={() => onDelete(message.id)} className="p-1.5 bg-gray-700 rounded-full hover:bg-red-600 text-gray-300" title="Xóa">🗑️</button>
             </>
           )}

           {isAdminOrMod && (
             <button onClick={() => onPin(message.id)} className={`p-1.5 bg-gray-700 rounded-full hover:bg-gray-600 ${message.id === pinnedMessageId ? 'text-blue-400' : 'text-gray-300'}`}>📌</button>
           )}
        </div>
      </div>
    </div>
  )
})
MessageBubble.displayName = 'MessageBubble'

// --- Main Chat Component ---

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; profile: Profile } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null)
  
  // Interaction States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Input States
  const [newMessage, setNewMessage] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCurrentUser()
    loadPinnedMessage()
  }, [])

  useEffect(() => {
    const messagesRef = dbRef(database, 'messages')
    const messagesQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(100))

    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const messagesList: Message[] = Object.entries(data).map(([id, msg]: [string, any]) => ({
          id, ...msg, reactions: msg.reactions || {}, readBy: msg.readBy || {}
        }))
        setMessages(messagesList.sort((a, b) => a.timestamp - b.timestamp))
      } else {
        setMessages([])
      }
      setLoading(false)
    })
    return () => off(messagesRef)
  }, [])

  useEffect(() => {
    if (!editingMessage) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, imagePreview, replyingTo])

  const loadCurrentUser = async () => {
    try {
      const { user } = await authService.getUser()
      if (user) {
        const { profile } = await profileService.getProfile(user.id)
        setCurrentUser({ id: user.id, profile: profile || { role: 'user' } as any })
      }
    } catch (e) { console.error(e) }
  }

  const loadPinnedMessage = () => {
    onValue(dbRef(database, 'chatRoomSettings/pinnedMessageId'), (snap) => setPinnedMessageId(snap.val()))
  }

  const getDisplayName = (p: Profile) => p.nickname || p.full_name || p.email || 'Anonymous'
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
      inputRef.current?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile()
        if (file) {
           setSelectedImage(file)
           const reader = new FileReader()
           reader.onloadend = () => setImagePreview(reader.result as string)
           reader.readAsDataURL(file)
        }
      }
    }
  }

  const handleSendOrUpdateMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if ((!newMessage.trim() && !selectedImage) || !currentUser) return

    const userMessageText = newMessage.trim()

    setUploading(true)
    try {
      // 1. UPDATE MESSAGE
      if (editingMessage) {
         if (userMessageText !== editingMessage.text) {
             await update(dbRef(database, `messages/${editingMessage.id}`), {
                 text: userMessageText,
                 isEdited: true
             })
         }
         setEditingMessage(null)
         setNewMessage('')
         setUploading(false)
         return
      }

      // 2. SEND NEW MESSAGE
      let imageUrl
      if (selectedImage) {
        const fileName = `chat/${currentUser.id}/${Date.now()}_${selectedImage.name}`
        const imgRef = storageRef(storage, fileName)
        await uploadBytes(imgRef, selectedImage)
        imageUrl = await getDownloadURL(imgRef)
      }

      const msgData: any = {
        text: userMessageText || (imageUrl ? '[Hình ảnh]' : ''),
        userId: currentUser.id,
        username: getDisplayName(currentUser.profile),
        avatar: currentUser.profile.avatar_url,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      }
      if (imageUrl) msgData.imageUrl = imageUrl
      if (replyingTo) {
        msgData.replyTo = {
          messageId: replyingTo.id,
          text: replyingTo.text,
          username: replyingTo.username
        }
      }

      await push(dbRef(database, 'messages'), msgData)
      
      setNewMessage('')
      setImagePreview(null)
      setSelectedImage(null)
      setReplyingTo(null)

      // ===============================================
      // --- LOGIC BOT ALPHA TRIGGER ---
      // ===============================================
      const lowerText = userMessageText.toLowerCase()
      if (lowerText.startsWith('@alpha') || lowerText.startsWith('!bot')) {
        
        // Tách câu hỏi
        const prompt = userMessageText.replace(/^(@alpha|!bot)/i, '').trim()
        
        if (prompt) {
           // Gọi Server Action
           askGemini(prompt).then(async (res) => {
             if (res.text) {
               // Bot trả lời -> Push tin nhắn bot
               const botMsgData = {
                 text: res.text,
                 userId: BOT_PROFILE.id,
                 username: BOT_PROFILE.username,
                 avatar: BOT_PROFILE.avatar,
                 timestamp: Date.now(),
                 createdAt: serverTimestamp(),
                 replyTo: { 
                   messageId: 'bot-reply',
                   text: userMessageText,
                   username: getDisplayName(currentUser.profile)
                 }
               }
               await push(dbRef(database, 'messages'), botMsgData)
             }
           })
        }
      }
      // ===============================================

    } catch (err) {
      console.error(err)
      alert('Thao tác thất bại')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteMessage = async (msgId: string) => {
      if(!confirm('Bạn có chắc muốn xóa tin nhắn này?')) return
      try {
          await remove(dbRef(database, `messages/${msgId}`))
          if (pinnedMessageId === msgId) {
             await update(dbRef(database, 'chatRoomSettings'), { pinnedMessageId: null })
          }
      } catch (error) {
          console.error(error)
          alert('Không thể xóa tin nhắn')
      }
  }

  const handleStartEdit = (msg: Message) => {
      setEditingMessage(msg)
      setNewMessage(msg.text)
      setReplyingTo(null)
      setImagePreview(null)
      setSelectedImage(null)
      inputRef.current?.focus()
  }

  const handleReaction = async (msgId: string, type: string) => {
    if (!currentUser) return
    const path = `messages/${msgId}/reactions/${currentUser.id}`
    const snap = await get(dbRef(database, path))
    if (snap.exists() && snap.val().type === type) {
      await update(dbRef(database, `messages/${msgId}/reactions`), { [currentUser.id]: null })
    } else {
      const reactionData = {
        userId: currentUser.id,
        username: getDisplayName(currentUser.profile),
        type
      }
      await update(dbRef(database, `messages/${msgId}/reactions`), { [currentUser.id]: reactionData })
    }
  }

  const handlePin = async (msgId: string) => {
    const isAdmin = ['admin', 'mod'].includes(currentUser?.profile.role || '')
    if (!isAdmin) return
    const newPin = pinnedMessageId === msgId ? null : msgId
    await update(dbRef(database, 'chatRoomSettings'), { pinnedMessageId: newPin })
  }

  const pinnedMsg = useMemo(() => messages.find(m => m.id === pinnedMessageId), [messages, pinnedMessageId])
  const isAdminOrMod = useMemo(() => ['admin', 'mod'].includes(currentUser?.profile.role || ''), [currentUser])

  if (loading) return <div className="h-[600px] flex items-center justify-center bg-[#0e1621] text-white">Đang tải...</div>

  return (
    <div className="flex flex-col h-[600px] md:h-[700px] w-full max-w-4xl mx-auto bg-[#0e1621] border border-gray-800 rounded-lg overflow-hidden font-sans shadow-2xl relative">
      
      {/* Lightbox Overlay */}
      {lightboxUrl && <Lightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-[#17212b] border-b border-[#0e1621] shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold">
              💰
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Kiếm tiền đi chợ</h3>
              <p className="text-gray-400 text-xs">{messages.length} tin nhắn</p>
            </div>
        </div>
      </div>

      {/* Pinned Message */}
      {pinnedMsg && (
        <div className="bg-[#17212b] px-4 py-2 flex items-center gap-3 border-b border-[#0e1621] cursor-pointer hover:bg-[#202b36] transition-colors shrink-0"
             onClick={() => document.getElementById(`msg-${pinnedMsg.id}`)?.scrollIntoView({behavior: 'smooth', block: 'center'})}>
          <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
          <div className="flex-1 min-w-0">
            <p className="text-blue-400 text-xs font-semibold">Tin nhắn được ghim</p>
            <p className="text-white text-sm truncate opacity-90">{pinnedMsg.text}</p>
          </div>
          {isAdminOrMod && (
             <button onClick={(e) => { e.stopPropagation(); handlePin(pinnedMsg.id) }} className="text-gray-400 hover:text-white">✕</button>
          )}
        </div>
      )}

      {/* Messages List */}
      <div 
        className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-1 bg-[#0e1621] scroll-smooth"
        style={{ backgroundImage: 'url("https://web.telegram.org/img/bg_0.png")', backgroundBlendMode: 'overlay' }}
      >
        {messages.map((msg, idx) => {
          const isOwn = msg.userId === currentUser?.id
          const prevMsg = messages[idx - 1]
          const isChain = prevMsg && prevMsg.userId === msg.userId && (msg.timestamp - prevMsg.timestamp < 60000)
          
          return (
            <div id={`msg-${msg.id}`} key={msg.id}>
              {(!prevMsg || new Date(msg.timestamp).getDate() !== new Date(prevMsg.timestamp).getDate()) && (
                <div className="flex justify-center my-4">
                  <span className="bg-[#00000060] text-gray-300 text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                    {new Date(msg.timestamp).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              )}
              
              <MessageBubble 
                message={msg}
                isOwn={isOwn}
                isChain={!!isChain}
                onReply={setReplyingTo}
                onReact={handleReaction}
                onPin={handlePin}
                onDelete={handleDeleteMessage}
                onEdit={handleStartEdit}
                onViewImage={setLightboxUrl}
                isAdminOrMod={isAdminOrMod}
                pinnedMessageId={pinnedMessageId}
              />
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#17212b] p-2 sm:p-3 pb-4 shrink-0">
        {/* Helper Bar: Reply OR Edit */}
        {(replyingTo || editingMessage) && (
          <div className="flex items-center justify-between bg-[#0e1621] p-2 rounded-t-lg border-l-4 border-blue-500 mb-2 animate-slideUp">
            <div className="overflow-hidden">
               <p className="text-blue-400 text-xs font-bold">
                   {editingMessage ? 'Đang sửa tin nhắn' : `Trả lời ${replyingTo?.username}`}
               </p>
               <p className="text-gray-300 text-sm truncate">
                   {editingMessage ? editingMessage.text : replyingTo?.text}
               </p>
            </div>
            <button onClick={() => { setReplyingTo(null); setEditingMessage(null); setNewMessage('') }} className="text-gray-500 hover:text-white p-2">✕</button>
          </div>
        )}

        {imagePreview && (
          <div className="relative inline-block mb-2 animate-fadeIn">
            <img src={imagePreview} className="h-20 rounded-lg border border-gray-600" alt="preview" />
            <button onClick={() => { setImagePreview(null); setSelectedImage(null) }} className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-1 shadow hover:bg-red-500">✕</button>
          </div>
        )}

        {/* Input Controls */}
        <div className="flex items-end gap-2 bg-[#0e1621] p-1 rounded-xl border border-gray-700">
           <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-blue-400 transition-colors" disabled={!!editingMessage}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
           </button>
           <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />

           <input 
             ref={inputRef}
             type="text" 
             value={newMessage}
             onChange={(e) => setNewMessage(e.target.value)}
             onKeyDown={(e) => e.key === 'Enter' && handleSendOrUpdateMessage()}
             onPaste={handlePaste}
             placeholder={editingMessage ? "Sửa tin nhắn..." : "Nhập tin nhắn..."}
             className="flex-1 bg-transparent text-white p-3 focus:outline-none placeholder-gray-500"
             disabled={uploading}
           />

           <div className="relative">
              <button onClick={() => setShowEmoji(!showEmoji)} className="p-3 text-gray-400 hover:text-yellow-400 transition-colors">😊</button>
              {showEmoji && (
                <div className="absolute bottom-12 right-0 bg-[#17212b] border border-gray-700 rounded-lg p-2 grid grid-cols-6 gap-2 w-64 shadow-xl z-50">
                  {['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '❤️', '😭', '😡', '🎉', '🔥'].map(e => (
                    <button key={e} onClick={() => { setNewMessage(prev => prev + e); inputRef.current?.focus() }} className="text-2xl hover:bg-white/10 rounded p-1 transition">{e}</button>
                  ))}
                </div>
              )}
           </div>

           {newMessage.trim() || selectedImage ? (
             <button 
                onClick={() => handleSendOrUpdateMessage()} 
                disabled={uploading}
                className="p-3 text-blue-500 hover:text-blue-400 transition-transform transform active:scale-90"
             >
                {editingMessage ? (
                     <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                     <svg className="w-6 h-6 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                )}
             </button>
           ) : (
             <div className="p-3 text-gray-600">
                <svg className="w-6 h-6 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
             </div>
           )}
        </div>
      </div>
    </div>
  )
}
