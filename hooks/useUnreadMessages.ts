import { useState, useEffect } from 'react'
import { database } from '@/lib/firebaseClient'
import { ref, onValue, off, query, orderByChild } from 'firebase/database'
import { authService } from '@/services/auth.service'

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { user } = await authService.getUser()
        if (user) {
          setCurrentUserId(user.id)
        }
      } catch (error) {
        console.error('Error loading user:', error)
      }
    }

    loadUser()
  }, [])

  useEffect(() => {
    if (!currentUserId) {
      setUnreadCount(0)
      return
    }

    const messagesRef = ref(database, 'messages')
    const messagesQuery = query(messagesRef, orderByChild('timestamp'))

    const unsubscribe = onValue(messagesQuery, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        let count = 0
        Object.entries(data).forEach(([id, msg]: [string, any]) => {
          // Count messages that are not from current user and not read by current user
          if (msg.userId !== currentUserId) {
            const readBy = msg.readBy || {}
            if (!readBy[currentUserId]) {
              count++
            }
          }
        })
        setUnreadCount(count)
      } else {
        setUnreadCount(0)
      }
    })

    return () => {
      off(messagesRef)
    }
  }, [currentUserId])

  return unreadCount
}
